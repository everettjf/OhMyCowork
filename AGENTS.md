# OhMyCowork Agents

This repo includes a local agent runtime built as a Tauri sidecar.

## Runtime flow
1) UI sends a `send_message` command through Tauri.
2) Tauri forwards JSON-RPC over stdin to the sidecar.
3) Sidecar runs DeepAgents, calls tools/subagents, and prints JSON results.
4) Status events are emitted as `agent:status` and rendered in the UI.

## Sidecar
- Entry: `sidecar/agent.js`
- Protocol: JSON-RPC over stdin/stdout
- Model: OpenRouter via LangChain `ChatOpenAI`
- Skills: loaded from DeepAgents user/project skill directories

## Tools (sidecar)
- `get_time`, `get_timezone`
- `random_number`, `generate_uuid`
- `calculate_expression`, `run_node`
- `internet_search` (Tavily; enabled only with key)
- `agent_browser` (Playwright CLI wrapper)

## Subagents
- `folder-organizer`: organizes a folder into category subfolders

## Status events
Tools should emit status for visibility:
- `tool_start` / `tool_end`
- `tool_error`

Events are sent as:
```json
{"event":"agent_status","requestId":"...","stage":"tool_start","tool":"internet_search","detail":{"query":"..."}}
```

## Workspace access
- Workspace path is passed into the sidecar by the UI.
- Filesystem tools use a virtual root mapped to the workspace only.
- Do not use absolute system paths inside tools.

## Adding a new tool
1) Implement in `sidecar/tools/`.
2) Export it from `sidecar/tools/index.js`.
3) Register it in `sidecar/agent.js` tools array.
4) Emit status events for UI visibility.
