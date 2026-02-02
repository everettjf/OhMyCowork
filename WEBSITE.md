# OhMyCowork Website Copy

## Product Name
OhMyCowork

## One-Liner
A local-first AI coworker desktop app that helps you chat, automate tasks, and work directly with your files.

## Tagline Options
1. Your local AI coworker for real work.
2. Chat, automate, and ship — from one desktop workspace.
3. Keep focus. Let your AI coworker handle the busywork.

## Hero Section
### Headline
Your Local AI Coworker for Focused Work

### Subheadline
OhMyCowork combines chat, workspace tools, browser automation, and multi-provider LLM support in one desktop app.

### Primary CTA
Download for macOS

### Secondary CTA
View on GitHub

### Supporting Note
Built for privacy-conscious workflows: local-first architecture, explicit workspace access, and transparent tool usage.

## Why This Exists
There are many AI coworker products already. I built OhMyCowork anyway — to match my own workflow, move faster on ideas, and keep more control locally.

Domain: **ohmyco.work**

## Key Value Props
- Local-first desktop app (Tauri)
- AI chat with visible tool execution
- Workspace-aware automation
- 10-provider LLM support (default: OpenRouter)
- Extensible tools, skills, and subagents

## Feature Blocks
### 1) Workspace-Native AI
- Select a workspace folder
- Browse files inside the app
- Run file-safe operations scoped to your workspace

### 2) Automation Toolkit
- File management (search, rename, move/copy, dedupe)
- Office docs (Excel/Word/PowerPoint)
- PDF workflows
- Image/video processing
- Data analysis + format conversion
- Archive and web utility operations

### 3) Browser Automation
- Playwright-based browser actions
- Navigation, form filling, screenshots
- Useful for repeatable web tasks

### 4) Multi-Provider LLM Configuration
Default provider is OpenRouter, with built-in presets for:
- OpenRouter
- OpenAI
- Groq
- Together
- Fireworks
- DeepSeek
- Mistral
- Perplexity
- xAI
- Moonshot (Kimi)

Each provider has independent API key, model, and base URL settings.

### 5) Skills + Subagents
- Built-in and project/user skills support
- Dedicated folder-organizer subagent
- Designed for extensibility

## Transparency & Safety
- Tool calls are surfaced in the UI
- Workspace path boundaries are enforced
- User chooses what folder the app can access

## Ideal Users
- Indie hackers
- Engineers and technical founders
- Power users who want local control
- Teams that prefer explicit, auditable AI tool usage

## Current Status
OhMyCowork is actively under development.

- Features are evolving quickly
- APIs and UX may change
- More testing is still needed before production-grade stability

## Tech Stack (for technical audience)
- Frontend: React + TypeScript + Tailwind
- Desktop shell: Tauri (Rust backend)
- Sidecar runtime: Node.js + DeepAgents + LangChain
- Model access: configurable OpenAI-compatible providers

## Suggested Website Sections
1. Hero
2. Why OhMyCowork
3. Core Capabilities
4. Multi-Provider Support
5. Architecture Snapshot
6. Development Status
7. Open Source / GitHub CTA
8. FAQ

## FAQ
### Is this cloud-only?
No. It is local-first and runs as a desktop app.

### Can it access my whole disk?
No. It only operates in the workspace you select.

### Which model providers are supported?
It supports 10 OpenAI-compatible providers out of the box, with OpenRouter as default.

### Is it production-ready?
Not yet. It is actively being developed and still needs broader testing.

## Footer CTA
Build with your AI coworker, not around one.

- Star the repo
- Try the latest build
- Share feedback and issues
