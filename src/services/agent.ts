import { invoke } from "@tauri-apps/api/core";

export type ChatMessage = {
  role: string;
  content: string;
};

export type AgentConfig = {
  apiKey: string;
  model: string;
  tavilyApiKey?: string;
};

export async function sendMessage(
  config: AgentConfig,
  messages: ChatMessage[],
  requestId: string,
  workspacePath?: string | null
): Promise<string> {
  return invoke<string>("send_message", {
    apiKey: config.apiKey,
    model: config.model,
    messages,
    workspacePath: workspacePath ?? null,
    tavilyApiKey: config.tavilyApiKey || null,
    requestId,
  });
}
