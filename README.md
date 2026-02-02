# OhMyCowork

A local-first AI coworker desktop app for focused work.

There are already many AI coworker products on the market, but I still wanted to build one myself around my own workflow and product ideas. I also registered **ohmyco.work** for this project.

## Project Status

OhMyCowork is **actively under development**.

- APIs and UX may change frequently
- Some modules are still being stabilized
- The project still needs broader and deeper testing before production use

If you find issues, please open an issue or PR.

## What It Does

- Multi-thread desktop chat (Tauri + React)
- Workspace browsing and file-aware task execution
- Tool execution with visible status updates
- Markdown + KaTeX rendering
- Skills and subagent support

## Tooling Highlights

- **File management**: search, rename, copy/move/delete, duplicate detection, folder organization
- **Office**: Excel / Word / PowerPoint generation and manipulation
- **PDF**: create, merge/split, extract, watermark, paginate
- **Media**: image transforms + video processing workflows
- **Data analysis**: CSV operations, stats, pivot/grouping, outlier checks
- **Archive**: zip/tar/gzip create/extract
- **Web**: HTTP, parsing, RSS, downloads
- **Format conversion**: markdown/html/docx, json/csv/yaml, base64
- **Browser automation**: Playwright-based interaction flows

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

If browser dependencies were not installed automatically:

```bash
bun run install:browser
```

## Configuration

Open **Settings** in the app and configure:

- OpenRouter API key (required)
- Default model

## Scripts

| Command | Description |
|---|---|
| `bun run tauri dev` | Start desktop app in dev mode |
| `bun run build` | Build frontend |
| `bun run tauri build` | Build production app |
| `bun run install:browser` | Install Playwright deps |
| `bun run build:dmg` | Build DMG package |
| `bun run build:pkg:appstore` | Build macOS PKG for App Store flow |

### Version Bump

1. Default patch: `bun run inc`
2. Minor: `bun run inc:minor`
3. Major: `bun run inc:major`

## Requirements

- Node.js 18+
- Bun
- Rust toolchain
- FFmpeg (for video operations)
- Optional: LibreOffice (for some conversion scenarios)

## Security Model

- Workspace access is explicit and user-selected
- File operations are constrained to workspace-relative paths
- Tool usage is surfaced in the UI

## Open Source Notes

Contributions are welcome. Suggested contributions:

- bug reports with reproducible steps
- test coverage improvements
- tool reliability/performance fixes
- docs and UX improvements

## License

MIT

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=everettjf/OhMyCowork&type=Date)](https://star-history.com/#everettjf/OhMyCowork&Date)
