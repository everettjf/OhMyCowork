# OhMyCowork

Local-first AI coworker for focused work: chat, browse your workspace, and automate tasks safely.

## Features

### Core Capabilities
- Desktop chat UI with multi-thread conversations
- Workspace picker + file tree browsing (read-only)
- Tooling with visible status updates in the chat
- Markdown + KaTeX rendering

### Automation Tools

#### File Management
- **File Search**: Search files using glob patterns
- **File Rename**: Batch rename with regex, prefix/suffix, sanitization
- **Duplicate Finder**: Find and remove duplicate files by hash
- **Folder Structure**: Create complex folder hierarchies
- **File Operations**: Copy, move, delete files and folders
- **Folder Organizer**: Auto-organize files into category folders

#### Office Documents
- **Excel**: Create, read, analyze spreadsheets, formulas, conditional formatting, CSV conversion, pivot tables
- **Word**: Create documents, templates, headers/footers, images, Markdown/HTML conversion
- **PowerPoint**: Create presentations with multiple layouts, charts, images, shapes, transitions

#### PDF Operations
- Create PDFs with text and images
- Merge and split PDFs
- Extract text content
- Add watermarks and page numbers
- Rotate pages

#### Media Processing
- **Images**: Resize, crop, convert, compress, blur, sharpen, watermark, thumbnails
- **Video**: Trim, merge, compress, convert, subtitles, frame extraction, GIF creation

#### Data Analysis
- Read and write CSV files
- Statistical analysis (mean, median, std, percentiles)
- Correlation matrices
- Group by aggregations
- Filter, sort, pivot tables
- Outlier detection (Z-score, IQR)

#### Archive Operations
- ZIP compression and extraction
- TAR/TAR.GZ archives
- GZIP compression

#### Web Operations
- HTTP requests (GET, POST, PUT, DELETE)
- HTML parsing with CSS selectors
- RSS feed parsing
- File downloads
- JSON API interaction

#### Format Conversion
- Image format conversion
- Markdown to HTML/DOCX
- HTML to Markdown
- JSON/CSV/YAML conversion
- Base64 encoding/decoding

#### Browser Automation
- Playwright-based browser control
- Page navigation, clicks, form filling
- Screenshots and PDF generation

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Desktop App (Tauri)                     │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React + Vite)     │     Backend (Rust)           │
│  ├── Multi-thread chat UI    │     ├── Tauri plugins        │
│  ├── Workspace browser       │     ├── Sidecar management   │
│  ├── Settings management     │     └── IPC handling         │
│  └── Tool status display     │                               │
├─────────────────────────────────────────────────────────────┤
│                    Node.js Sidecar                          │
│  ├── DeepAgents Framework                                   │
│  ├── LangChain + OpenRouter                                 │
│  ├── 25+ Tools                                              │
│  ├── Subagents                                              │
│  └── Skills System                                          │
└─────────────────────────────────────────────────────────────┘
```

### Communication Flow
1. Frontend sends message via Tauri IPC
2. Rust backend forwards JSON-RPC to sidecar
3. Sidecar processes with DeepAgents + tools
4. Status events stream back to UI
5. Final response returned to frontend

## Tech Stack

**Frontend**
- React 19.1
- Vite 7.0
- TypeScript 5.8
- Tailwind CSS + Radix UI
- React Markdown + KaTeX

**Desktop Framework**
- Tauri 2.0
- Plugins: dialog, fs, opener, store, shell

**Backend (Rust)**
- Tauri 2.0
- Tokio async runtime
- Serde JSON

**Sidecar (Node.js)**
- DeepAgents 1.5
- LangChain OpenAI
- ExcelJS, docx, pptxgenjs
- pdf-lib, sharp, fluent-ffmpeg
- And many more...

**APIs**
- OpenRouter (LLM routing)
- Tavily (web search, optional)

## Quick Start

```bash
# Install dependencies
bun install

# Start development
bun run tauri dev
```

### Browser Automation Setup
Browser automation dependencies install on `postinstall`. If it fails:
```bash
bun run install:browser
```

## Configuration

Open **Settings** in the app to configure:
- OpenRouter API key (required)
- Default model
- Tavily API key (optional, enables web search)

## Project Structure

```
OhMyCowork/
├── src/                    # React frontend
│   ├── App.tsx            # Main component
│   ├── components/        # UI components
│   ├── services/          # Tauri bridge
│   └── hooks/             # React hooks
├── src-tauri/             # Rust backend
│   ├── src/lib.rs         # Tauri setup + IPC
│   └── tauri.conf.json    # Tauri config
├── sidecar/               # Node.js agent
│   ├── agent.ts           # Main agent source
│   ├── dist/agent.js      # Compiled runtime entry
│   ├── tools/             # 25+ tool implementations
│   ├── subagents/         # Specialized agents
│   └── skills/            # Bundled skills
└── .deepagents/           # Project skills
```

## Security

- Workspace access is explicit: only the selected folder is available to tools
- All file paths are validated to stay within workspace
- Tool usage is surfaced to the user in the conversation view

## Scripts

| Command | Description |
|---------|-------------|
| `bun run tauri dev` | Start desktop app in dev mode |
| `bun run build` | Build frontend |
| `bun run tauri build` | Build production app |
| `bun run install:browser` | Install Playwright deps |

## Dependencies

### System Requirements
- **FFmpeg**: Required for video operations
- **Node.js**: v18+ for sidecar
- **Rust**: For Tauri compilation

### Optional
- **Tavily API key**: For web search functionality
- **LibreOffice**: For some format conversions

## Testing Tools

Each tool can be tested by asking the AI assistant in the chat:

### File Management
```
"Search for all TypeScript files in the project"
"Find duplicate files in my Downloads folder"
"Create a folder structure for a new React project"
```

### Office Documents
```
"Create an Excel file with sales data and calculate totals"
"Generate a Word document from this markdown"
"Create a 5-slide presentation about AI"
```

### PDF Operations
```
"Merge these 3 PDF files into one"
"Extract text from this PDF"
"Add page numbers to this document"
```

### Media Processing
```
"Resize all images in /photos to 800px width"
"Convert this video to GIF"
"Compress images in the uploads folder"
```

### Data Analysis
```
"Analyze this CSV file and show statistics"
"Find outliers in the price column"
"Group sales by region and sum amounts"
```

### Web Operations
```
"Fetch the headlines from this RSS feed"
"Download this image to my workspace"
"Parse the links from this webpage"
```

## License

MIT
