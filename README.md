# OhMyCowork

Local-first AI coworker desktop app for focused work.

## Status

Active development. APIs and UX may change.

## What It Does

- Multi-thread desktop chat (Tauri + React)
- Workspace browsing and file-aware task execution
- Tool execution with visible status updates
- Markdown rendering
- Skills and subagent support
- Tool-specific UI cards (web operations, file search)

## Architecture

```
Frontend (React) -> Tauri IPC -> Rust Backend -> Node.js Sidecar
                                              -> DeepAgents + Tools + Skills + Subagents
```

## Quick Start

```bash
# Install dependencies
bun install

# Start app in dev mode
bun run tauri dev
```

### Browser Automation Setup

```bash
bun run install:browser
```

## Configuration

Open **Settings** and configure:

- Provider API key (OpenRouter default)
- Model
- Base URL (if applicable)

## Tooling Highlights

- File management: search, rename, copy/move/delete, duplicate detection, folder organization
- Office: Excel / Word / PowerPoint generation and manipulation
- PDF: create, merge/split, extract, watermark, paginate
- Media: image transforms + video processing
- Data analysis: CSV operations, stats, pivot/grouping, outlier checks
- Archive: zip/tar/gzip create/extract
- Web: HTTP, parsing, RSS, downloads
- Format conversion: markdown/html/docx, json/csv/yaml, base64
- Browser automation: Playwright-based flows

## Scripts

| Command | Description |
|---|---|
| `bun run tauri dev` | Start desktop app in dev mode |
| `bun run build` | Build frontend |
| `bun run tauri build` | Build production app |
| `bun run install:browser` | Install Playwright deps |
| `bun run build:dmg` | Build DMG package |
| `bun run release:macos` | Build signed release artifacts via `scripts/release-macos.sh` |
| `bun run build:pkg:appstore` | Build macOS PKG for App Store flow |

## Requirements

- Node.js 18+
- Bun
- Rust toolchain
- FFmpeg (for video operations)

## Security Model

- Workspace access is explicit and user-selected
- File operations are constrained to workspace-relative paths
- Tool usage is surfaced in the UI
