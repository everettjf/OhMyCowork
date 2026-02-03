---
name: summarize
description: Summarize URLs or local documents using existing tools (web_operations, pdf_operations, word_operations, data_analysis).
---

# Summarize

Use this skill when the user asks to summarize:
- a web page, article, or documentation URL
- an RSS feed item
- a local PDF/Word/CSV file

## Trigger hints

- "summarize this link"
- "what is this article about"
- "extract key points"
- "summarize this file"

## Preferred workflow

1. Identify source type
- URL: use `web_operations` first.
- Local file: use the matching file tool first.

2. Extract content
- Web page: `web_operations.extract_text`.
- RSS/Atom: `web_operations.parse_rss`.
- JSON endpoint: `web_operations.parse_json_api`.
- PDF: `pdf_operations` with `extract_text`.
- Word: `word_operations` with `read`.
- CSV: `data_analysis.read_csv` then summarize key trends.

3. Summarize in layers
- One-paragraph overview.
- 3-7 key points.
- Actionable next steps or open questions.

## Quality rules

- Keep source facts separate from your inference.
- If extraction is partial, say what is missing.
- For very long content, provide section summary first, then expand on request.
- Preserve critical numbers, dates, and names.

## Limits and fallback

- If a URL blocks scraping, try `web_operations.http_request` or `parse_html` fallback.
- If video transcript is unavailable, clearly state the limitation and summarize available metadata/page text only.

## Output template

1. Overview (1 short paragraph)
2. Key points (3-7 bullets)
3. Risks/uncertainty (optional)
4. Suggested next steps (optional)

## Source attribution

Adapted from OpenClaw's `summarize` idea:
`https://github.com/openclaw/openclaw/tree/main/skills/summarize`
