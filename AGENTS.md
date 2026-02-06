# OhMyCowork Agents

This repo includes a local agent runtime built as a Tauri sidecar with 25+ automation tools.

## Architecture Overview

```
Frontend (React) -> Tauri IPC -> Rust Backend -> Node.js Sidecar
                                                    -> DeepAgents Framework
                                                       - Chat Model (OpenRouter)
                                                       - Tools
                                                       - Skills
                                                       - Subagents
```

## Runtime Flow

1. UI sends `send_message` through Tauri
2. Tauri forwards JSON-RPC over stdin to the sidecar
3. Sidecar runs DeepAgents with tools, skills, subagents
4. Status events are emitted as `agent:status`
5. Final response returned to UI

## Sidecar Details

- Entry (source): `sidecar/agent.ts`
- Entry (runtime): `sidecar/dist/agent.js`
- Protocol: JSON-RPC 2.0 over stdin/stdout
- Model: OpenRouter via LangChain `ChatOpenAI`
- Framework: DeepAgents with tools, skills, subagents

## Status Events

Tools emit status events for UI visibility:

```json
{
  "event": "agent_status",
  "requestId": "uuid",
  "stage": "tool_start|tool_end|tool_error",
  "tool": "tool_name",
  "detail": { "context": "varies" }
}
```

Skills filesystem access is also instrumented and emitted as `tool = "skills"`.

## Tool Reference

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

### PDF Operations

| Operation | Description |
|---|---|
| `create` | Create PDF with text/images |
| `merge` | Combine multiple PDFs |
| `split` | Extract pages |
| `extract_text` | Get text content |
| `add_watermark` | Add text watermark |
| `add_page_numbers` | Insert page numbers |
| `rotate_pages` | Rotate specified pages |
| `get_info` | Document metadata |
| `compress` | Reduce file size |

### Media Processing

#### Image Operations
| Operation | Description |
|---|---|
| `resize` | Resize with fit options |
| `crop` | Crop to dimensions |
| `convert` | Change format (jpeg, png, webp, avif) |
| `compress` | Reduce file size |
| `rotate` | Rotate by angle |
| `flip` | Horizontal/vertical flip |
| `blur` | Apply blur effect |
| `sharpen` | Sharpen image |
| `grayscale` | Convert to grayscale |
| `watermark` | Add text watermark |
| `thumbnail` | Smart crop thumbnail |
| `composite` | Overlay images |
| `get_info` | Image metadata |

#### Video Operations
| Operation | Description |
|---|---|
| `trim` | Cut video segment |
| `merge` | Combine videos |
| `extract_frames` | Export frames as images |
| `add_subtitle` | Burn subtitles |
| `compress` | Reduce file size |
| `convert` | Change format |
| `add_watermark` | Overlay watermark |
| `get_info` | Video metadata |
| `extract_audio` | Audio track only |
| `resize` | Change resolution |
| `gif` | Convert to animated GIF |

### Data Analysis

| Operation | Description |
|---|---|
| `read_csv` | Parse CSV file |
| `describe` | Data summary |
| `statistics` | Column stats (mean, median, std, percentiles) |
| `correlation` | Correlation matrix |
| `group_by` | Aggregate by column |
| `filter` | Filter rows by condition |
| `sort` | Sort by column |
| `pivot` | Pivot table |
| `outliers` | Detect outliers (Z-score, IQR) |
| `merge_datasets` | Join datasets |
| `transform` | Column transformations |

### Archive Operations

| Operation | Description |
|---|---|
| `zip` | Create ZIP archive |
| `unzip` | Extract ZIP |
| `tar` | Create TAR archive |
| `untar` | Extract TAR |
| `gzip` | GZIP compress |
| `gunzip` | GZIP decompress |
| `list` | List archive contents |

### Web Operations

| Operation | Description |
|---|---|
| `http_request` | HTTP requests (GET, POST, etc.) |
| `parse_html` | Parse HTML with CSS selectors |
| `extract_links` | Get all links from page |
| `extract_text` | Extract text content |
| `parse_rss` | Parse RSS/Atom feeds |
| `download_file` | Download to workspace |
| `parse_json_api` | JSON API interaction |

### Format Conversion

| Operation | Description |
|---|---|
| `image_convert` | Convert image formats |
| `markdown_to_html` | Markdown -> HTML |
| `markdown_to_docx` | Markdown -> Word |
| `html_to_markdown` | HTML -> Markdown |
| `json_to_csv` | JSON -> CSV |
| `csv_to_json` | CSV -> JSON |
| `yaml_to_json` | YAML -> JSON |
| `json_to_yaml` | JSON -> YAML |
| `text_to_base64` | Text -> Base64 |
| `base64_to_text` | Base64 -> Text |

## Skills System

Skills are loaded from:

- Bundled: `sidecar/skills/`
- Project: `.deepagents/skills/`
- User: `~/.deepagents/skills/`

## Subagents

| Name | Description |
|---|---|
| `folder-organizer` | Intelligent folder organization |

## Workspace Access

- Workspace path is passed from UI to sidecar
- All file tools use workspace-relative paths
- Path validation prevents escaping workspace root
