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

## Full Tools List

### Core Utilities

| Tool | Description | Parameters |
|---|---|---|
| `get_time` | Current time in multiple formats | - |
| `get_timezone` | System timezone info | - |
| `random_number` | Random integer in range | `min`, `max` |
| `generate_uuid` | UUID v4 generation | - |
| `calculate_expression` | Math evaluation | `expression` |
| `run_node` | Execute Node.js code | `code`, `timeoutMs?` |
| `agent_browser` | Browser automation | `args[]`, `session?`, `timeoutMs?` |

### File Management

| Tool | Description | Key Parameters |
|---|---|---|
| `file_search` | Glob pattern search | `pattern`, `path?`, `ignore?` |
| `file_rename` | Batch rename | `files[]`, `pattern?`, `replacement?`, `prefix?`, `suffix?` |
| `find_duplicates` | Find/delete duplicates | `path?`, `deleteAction?`, `minSize?` |
| `create_folders` | Create folder structure | `structure[]`, `basePath?` |
| `file_copy_move` | Copy or move files | `operation`, `source`, `destination` |
| `file_delete` | Delete files | `paths?`, `pattern?`, `dryRun?` |
| `organize_folder` | Auto-organize by type | `path`, `includeNested?` |

### Office Documents

| Tool | Operations | Key Features |
|---|---|---|
| `excel_operations` | create, read, analyze, add_sheet, write_formula, conditional_format, csv_to_excel, excel_to_csv, merge_files, pivot_summary | Formulas, conditional formatting, CSV conversion, pivot tables |
| `word_operations` | create, read, from_template, to_html, from_markdown, add_header_footer, add_image | Templates, Markdown conversion, headers/footers |
| `powerpoint_operations` | create, add_slides | Layouts, charts, images, shapes, transitions, themes |

### PDF Operations (`pdf_operations`)

- `create`: Create PDF with text/images
- `merge`: Combine multiple PDFs
- `split`: Extract pages
- `extract_text`: Get text content
- `add_watermark`: Add text watermark
- `add_page_numbers`: Insert page numbers
- `rotate_pages`: Rotate specified pages
- `get_info`: Document metadata
- `compress`: Reduce file size

### Media Processing

**`image_operations`**
- resize, crop, convert, compress, rotate, flip, blur, sharpen, grayscale, watermark, thumbnail, composite, get_info

**`video_operations`**
- trim, merge, extract_frames, add_subtitle, compress, convert, add_watermark, get_info, extract_audio, resize, gif

### Data Analysis (`data_analysis`)

- read_csv, describe, statistics, correlation, group_by, filter, sort, pivot, outliers, merge_datasets, transform

### Archive Operations (`archive_operations`)

- zip, unzip, tar, untar, gzip, gunzip, list

### Web Operations (`web_operations`)

- http_request, parse_html, extract_links, extract_text, parse_rss, download_file, parse_json_api

### Format Conversion (`format_conversion`)

- image_convert, markdown_to_html, markdown_to_docx, html_to_markdown, json_to_csv, csv_to_json, yaml_to_json, json_to_yaml, text_to_base64, base64_to_text

## Skills List

### Bundled Skills (`sidecar/skills/`)

| ID | Name | Description |
|---|---|---|
| `react-best-practices` | React Best Practices | Guidelines for writing performant React and Next.js applications |
| `web-design-guidelines` | Web Design Guidelines | Comprehensive guidelines for accessible, performant web interfaces |
| `code-review` | Code Review | Code review guidelines covering security, performance, and best practices |
| `git-commit-helper` | Git Commit Helper | Generate meaningful commit messages following conventional commits |

### Skill Loading Locations

- Bundled: `sidecar/skills/`
- Project: `.deepagents/skills/`
- User: `~/.deepagents/skills/`

### Subagents

- `folder-organizer`: Intelligent folder organization

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
