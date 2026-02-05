use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_shell::{process::CommandEvent, ShellExt};
use tokio::sync::oneshot;

static REQUEST_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct RpcRequest {
    id: u64,
    method: String,
    params: SendMessageParams,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SendMessageParams {
    provider: Option<String>,
    api_key: String,
    model: String,
    base_url: Option<String>,
    messages: Vec<ChatMessage>,
    workspace_path: Option<String>,
    request_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RpcResponse {
    id: Option<u64>,
    result: Option<String>,
    error: Option<RpcError>,
}

#[derive(Debug, Deserialize)]
struct RpcError {
    #[allow(dead_code)]
    code: i32,
    message: String,
}

type PendingRequests = Mutex<HashMap<u64, oneshot::Sender<Result<String, String>>>>;

#[tauri::command]
async fn send_message(
    app: tauri::AppHandle,
    provider: Option<String>,
    api_key: String,
    model: String,
    base_url: Option<String>,
    messages: Vec<ChatMessage>,
    workspace_path: Option<String>,
    request_id: Option<String>,
) -> Result<String, String> {
    let id = REQUEST_ID.fetch_add(1, Ordering::SeqCst);

    let request = RpcRequest {
        id,
        method: "sendMessage".to_string(),
        params: SendMessageParams {
            provider,
            api_key,
            model,
            base_url,
            messages,
            workspace_path,
            request_id,
        },
    };

    let request_json = serde_json::to_string(&request).map_err(|e| e.to_string())?;

    let (tx, rx) = oneshot::channel();

    // Store the sender for this request
    {
        let pending = app.state::<PendingRequests>();
        let mut map = pending.lock().unwrap();
        map.insert(id, tx);
    }

    // Get the sidecar stdin and write the request
    let sidecar_stdin = app.state::<Mutex<Option<tauri_plugin_shell::process::CommandChild>>>();
    {
        let mut stdin_guard = sidecar_stdin.lock().unwrap();
        if let Some(ref mut child) = *stdin_guard {
            let data = (request_json + "\n").into_bytes();
            child.write(&data).map_err(|e| format!("Failed to write to sidecar: {}", e))?;
        } else {
            return Err("Sidecar not running".to_string());
        }
    }

    // Wait for response with timeout
    match tokio::time::timeout(std::time::Duration::from_secs(60), rx).await {
        Ok(Ok(result)) => result,
        Ok(Err(_)) => Err("Request cancelled".to_string()),
        Err(_) => Err("Request timed out".to_string()),
    }
}

fn handle_sidecar_output(app: &tauri::AppHandle, line: &str) {
    // Skip empty lines
    if line.trim().is_empty() {
        return;
    }

    if let Ok(value) = serde_json::from_str::<serde_json::Value>(line) {
        if let Some(event_name) = value.get("event").and_then(|v| v.as_str()) {
            if event_name == "agent_status" {
                let _ = app.emit("agent:status", value);
                return;
            }
            if event_name == "assistant_delta" {
                let _ = app.emit("agent:delta", value);
                return;
            }
        }
    }

    // Try to parse as RPC response
    if let Ok(response) = serde_json::from_str::<RpcResponse>(line) {
        if let Some(id) = response.id {
            let pending = app.state::<PendingRequests>();
            let mut map = pending.lock().unwrap();
            if let Some(tx) = map.remove(&id) {
                let result = if let Some(err) = response.error {
                    Err(err.message)
                } else {
                    Ok(response.result.unwrap_or_default())
                };
                let _ = tx.send(result);
            }
        }
        // Ignore messages without id (like {ready: true})
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .manage(PendingRequests::new(HashMap::new()))
        .manage(Mutex::new(None::<tauri_plugin_shell::process::CommandChild>))
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Spawn the sidecar
            let (mut rx, child) = app_handle
                .shell()
                .sidecar("agent")
                .map_err(|e| format!("Failed to create sidecar command: {}", e))?
                .spawn()
                .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

            // Store the child process for writing
            {
                let sidecar_state = app_handle.state::<Mutex<Option<tauri_plugin_shell::process::CommandChild>>>();
                let mut guard = sidecar_state.lock().unwrap();
                *guard = Some(child);
            }

            // Handle sidecar output in background
            let app_handle_clone = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                let mut stdout_buf = String::new();
                let mut stderr_buf = String::new();

                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line_bytes) => {
                            if let Ok(chunk) = String::from_utf8(line_bytes) {
                                stdout_buf.push_str(&chunk);
                                while let Some(pos) = stdout_buf.find('\n') {
                                    let mut line = stdout_buf[..pos].to_string();
                                    stdout_buf = stdout_buf[pos + 1..].to_string();
                                    if line.ends_with('\r') {
                                        line.pop();
                                    }
                                    handle_sidecar_output(&app_handle_clone, &line);
                                }
                            }
                        }
                        CommandEvent::Stderr(line_bytes) => {
                            if let Ok(chunk) = String::from_utf8(line_bytes) {
                                stderr_buf.push_str(&chunk);
                                while let Some(pos) = stderr_buf.find('\n') {
                                    let mut line = stderr_buf[..pos].to_string();
                                    stderr_buf = stderr_buf[pos + 1..].to_string();
                                    if line.ends_with('\r') {
                                        line.pop();
                                    }
                                    eprintln!("[sidecar stderr] {}", line);
                                }
                            }
                        }
                        CommandEvent::Error(err) => {
                            eprintln!("[sidecar error] {}", err);
                        }
                        CommandEvent::Terminated(status) => {
                            eprintln!("[sidecar terminated] {:?}", status);
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![send_message])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
