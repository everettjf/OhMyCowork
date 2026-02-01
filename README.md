# OhMyCowork

Local-first AI coworker for focused work: chat, browse your workspace, and automate tasks safely.

## What it does
- Desktop chat UI with multi-thread conversations
- Workspace picker + file tree browsing (read-only)
- Tooling with visible status updates in the chat
- Optional web search via Tavily
- Browser automation via agent-browser (Playwright)
- Folder organizer subagent
- Markdown + KaTeX rendering

## Tech stack
- Tauri + React + Vite
- OpenRouter models via LangChain
- DeepAgents tools + subagents
- Tavily search (optional)

## Quick start
```bash
bun install
bun run tauri dev
```

Browser automation dependencies install on `postinstall`. If it fails, run:
```bash
bun run install:browser
```

## Configuration
Open **Settings** in the app to configure:
- OpenRouter API key
- Default model
- Tavily API key (optional, enables web search tool)

## How it works (high level)
- Frontend calls Tauri `send_message`
- Tauri spawns a Node sidecar (`sidecar/agent.js`)
- Sidecar runs DeepAgents + tools and streams status events
- UI renders tool usage and the final response

## Project structure
- `src/` React UI and hooks
- `src-tauri/` Tauri backend and sidecar process wiring
- `sidecar/` Agent runtime, tools, and subagents

## Notes
- Workspace access is explicit: only the selected folder is available to tools.
- Tool usage is surfaced to the user in the conversation view.

## Scripts
- `bun run tauri dev` start desktop app
- `bun run build` build frontend
- `bun run install:browser` install Playwright deps for agent-browser
