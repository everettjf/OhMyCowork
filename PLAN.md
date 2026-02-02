# OhMyCowork Plan (2026-01-30)

## Goals
- Build a local-first AI coworker: chat + workspace files + browser access/automation
- Keep the UX visible, controllable, and auditable (transparent tool usage)
- Differentiate with local privacy + browser automation + workflow orchestration

## Current Capabilities (already implemented)
- Desktop app: Tauri + React with thread-based chat
- Workspace: folder selection and file tree browsing
- Tools: time/timezone/random/UUID/calculator/run Node/browser automation
- Subagent: folder organizer
- Rendering: Markdown + KaTeX

## Main Gaps (vs mature products)
- Conversation layer: persistence, retrieval, labels/favorites
- File layer: file preview/editing, full-text search, drag-and-drop upload, batch actions
- Tool layer: deeper PDF/CSV/Excel, image generation, OCR, data collection
- Browser layer: embedded browsing + automation + visual playback
- Multi-agent layer: task decomposition, execution plans, rollback/retry

## Priority: Browser Access/Automation
### Option Stack
- A. Embedded webview: reading and manual interaction zone
- B. Local Playwright: automation, screenshots, form fill
- C. Cloud browser Live View: human-in-the-loop (login/2FA)
- D. Computer Use: UI-level automation (higher cost and reliability requirements)

### Near-Term Recommendation
- Ship B first (local Playwright / agent-browser) as practical automation
- Then add A for in-app browsing, and later C for handoff/live takeover

## Suggested Roadmap
### P0 (1-2 weeks)
- Local conversation persistence (SQLite / encrypted store)
- File preview (text/markdown/code)
- Better tool-call visualization (result summary cards)
- agent-browser integration

### P1 (2-4 weeks)
- Doc/code indexing and full-text search
- File actions: drag-and-drop upload, batch move/rename
- Basic CSV/Excel/PDF tools
- Structured browser output (summary/citations)

### P2 (1-2 months)
- Multi-agent plan/execute orchestration
- Task history and replay
- Multi-model collaboration / A-B comparison

### P3 (long-term)
- Optional cloud sync (E2E encryption optional)
- Browser Live View (human-in-the-loop)
- Multi-device, notifications, background worker

## agent-browser Integration Plan (this phase)
### Goal
- Add `agent_browser` tool for local browser automation
- Support session reuse, screenshots, extraction, and form actions

### Integration Steps
1) Add `agent_browser` tool wrapper in sidecar
2) Register the tool in the agent and document usage in system prompt
3) Provide setup guidance (agent-browser + browser deps)

### Usage Examples
- Open page: `["open", "https://example.com"]`
- Click element: `["click", "text=Login"]`
- Fill input: `["fill", "input[name=email]", "test@example.com"]`
- Screenshot: `["screenshot", "page.png"]`

## Risks & Constraints
- Login/CAPTCHA requires human-in-the-loop takeover in some flows
- Cross-platform browser dependencies (Playwright/Chromium)
- Security: command restrictions and auditable tool-call logs

## Acceptance Criteria
- Can reliably complete: open page -> fill form -> screenshot -> answer
- Tool usage is traceable; failures can be reproduced
- Browser sessions can be reused
