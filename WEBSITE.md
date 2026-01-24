# Oh My Cowork

## One-liner
Your local AI coworker for focused work: chat, browse your workspace, and automate tasks safely.

## Hero
- Headline: Meet your always-on coworker for deep work.
- Subhead: Ask questions, search the web, and organize files without leaving your desktop.
- Primary CTA: Download for macOS
- Secondary CTA: View the docs

## Problem
Knowledge work is fragmented across docs, files, and browser tabs. Switching contexts kills momentum.

## Solution
Oh My Cowork keeps your tools, workspace, and models in one place. It answers questions, performs structured searches, and can organize folders with a dedicated subagent.

## Key Features
- Local workspace context: browse project folders inside the app.
- Web search tool: fresh results powered by Tavily.
- Tool status transparency: see which tools were used while the model works.
- Folder organizer subagent: clean up messy folders by file type.
- Model choice: plug in any OpenRouter model.
- Math-ready markdown: LaTeX rendering with KaTeX.

## How It Works
1) Choose a workspace folder.
2) Ask your question.
3) The agent uses tools (search, utilities, or subagents) and replies with a clear, formatted answer.

## Use Cases
- Research and summarize a topic with citations.
- Quickly organize downloads or project folders.
- Generate UUIDs, timestamps, or quick calculations.
- Compare models and prompts in a single thread.

## Trust & Safety
- Workspace access is explicit.
- Tool calls are surfaced in the UI.
- File organization reports moved items and errors.

## Tech Stack
- Tauri + React
- OpenRouter models
- DeepAgents + LangChain tools
- Tavily search

## FAQ
**Which models are supported?**  
Any model available on OpenRouter.

**Can it access my files?**  
Only the workspace you choose. Tools are scoped to that folder.

**Does it support LaTeX?**  
Yes. Inline and block math are rendered with KaTeX.

## Final CTA
Stay in flow. Let your coworker handle the busywork.
