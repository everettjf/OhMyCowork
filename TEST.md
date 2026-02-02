# OhMyCowork Test Checklist (Step-by-Step Manual Verification)

This document is organized as: capability -> test prompt -> expected result.
You can execute the cases in order directly in the chat UI.

> Note: the sidecar has been migrated to TypeScript. There are 111 automated unit tests; this checklist focuses on end-to-end manual validation.

## 0) Run automated checks first

```bash
cd sidecar
npm install --legacy-peer-deps
npm run build
npm test
```

Pass criteria:
- `npm run build` succeeds
- `npm test` shows `111 passed`

---

## 1) Manual test setup

1. Start the app: `bun run tauri dev`
2. Select a clean workspace folder (recommended: new empty folder)
3. Prepare files in workspace:
   - `/notes.txt`
   - `/data.csv`
   - `/test.jpg`
   - `/test.pdf`
   - `/test.mp4` (optional, for video tests)
4. For browser automation, ensure browser dependencies are installed

---

## 2) Core Utilities

### 2.1 get_time
- [ ] Prompt: `What time is it now? Return ISO, locale, and epoch milliseconds.`
- [ ] Expect: `iso`, `locale`, and `epochMs`

### 2.2 get_timezone
- [ ] Prompt: `Get my system timezone information.`
- [ ] Expect: timezone name and offset info

### 2.3 random_number
- [ ] Prompt: `Generate a random integer between 1 and 100.`
- [ ] Expect: integer in range

### 2.4 generate_uuid
- [ ] Prompt: `Generate a UUID v4.`
- [ ] Expect: valid UUID format

### 2.5 calculate_expression
- [ ] Prompt: `Calculate (123 + 456) * 2 / 3.`
- [ ] Expect: result `386`

### 2.6 run_node
- [ ] Prompt: `Use Node.js to return the first 10 Fibonacci numbers as an array.`
- [ ] Expect: `[0,1,1,2,3,5,8,13,21,34]`

### 2.7 agent_browser
- [ ] Prompt: `Open https://example.com with browser automation and save a screenshot as /example.png.`
- [ ] Expect: page opens and screenshot is created in workspace

---

## 3) File Management

### 3.1 file_search
- [ ] Prompt: `Search all .txt files in the workspace.`
- [ ] Expect: matched files with metadata

### 3.2 file_rename
- [ ] Prompt: `Add prefix backup_ to all .txt files, dry-run first.`
- [ ] Expect: preview only, no real rename, includes `wouldRenameTo`

### 3.3 find_duplicates
- [ ] Prompt: `Find duplicate files in workspace, report only.`
- [ ] Expect: duplicate groups by hash

### 3.4 create_folders
- [ ] Prompt: `Create folder structure: project/src, project/tests, project/docs.`
- [ ] Expect: directories created

### 3.5 file_copy_move
- [ ] Prompt: `Copy /notes.txt to /backup/notes.txt.`
- [ ] Expect: destination exists and content matches

### 3.6 file_delete
- [ ] Prompt: `Delete /backup with dry-run.`
- [ ] Expect: deletion preview, no actual deletion

### 3.7 organize_folder
- [ ] Prompt: `Organize workspace root by file type.`
- [ ] Expect: files moved into category folders (Documents/Images/Code/...)

---

## 4) Office Document Tools

### 4.1 excel_operations
- [ ] Prompt: `Create /sales.xlsx with columns Product/Quantity/Price and add 3 rows.`
- [ ] Expect: file created
- [ ] Prompt: `Read /sales.xlsx and summarize.`
- [ ] Expect: sheet info, row/column stats, preview

### 4.2 word_operations
- [ ] Prompt: `Create /report.docx titled Monthly Report with paragraphs and bullet list.`
- [ ] Expect: valid docx generated
- [ ] Prompt: `Convert /report.docx to HTML.`
- [ ] Expect: html output produced

### 4.3 powerpoint_operations
- [ ] Prompt: `Create /presentation.pptx about AI Basics with title + content slides.`
- [ ] Expect: pptx generated
- [ ] Prompt: `Append one bar chart slide with sales data.`
- [ ] Expect: slide added successfully

---

## 5) PDF (pdf_operations)

- [ ] Prompt: `Create /hello.pdf titled Hello World with one paragraph.`
- [ ] Expect: PDF created
- [ ] Prompt: `Read metadata and page count from /test.pdf.`
- [ ] Expect: metadata returned
- [ ] Prompt: `Extract text from /test.pdf.`
- [ ] Expect: text returned
- [ ] Prompt: `Merge /hello.pdf and /test.pdf into /combined.pdf.`
- [ ] Expect: merged PDF created
- [ ] Prompt: `Add watermark "Confidential" to /test.pdf.`
- [ ] Expect: watermarked output generated

---

## 6) Media

### 6.1 image_operations
- [ ] Prompt: `Get info for /test.jpg.`
- [ ] Expect: dimensions, format, size
- [ ] Prompt: `Resize /test.jpg to width 800 and export.`
- [ ] Expect: resized image generated

### 6.2 video_operations (requires ffmpeg)
- [ ] Prompt: `Get duration/resolution/codec info for /test.mp4.`
- [ ] Expect: video metadata returned
- [ ] Prompt: `Trim first 10 seconds from /test.mp4 into /clip.mp4.`
- [ ] Expect: short clip generated

---

## 7) Data Analysis (data_analysis)

- [ ] Prompt: `Read /data.csv and show preview rows.`
- [ ] Expect: columns, row count, preview
- [ ] Prompt: `Compute mean/median/std for salary column.`
- [ ] Expect: statistics returned
- [ ] Prompt: `Group by city and compute average salary.`
- [ ] Expect: group-by output

---

## 8) Archive (archive_operations)

- [ ] Prompt: `Compress /project folder into /project.zip.`
- [ ] Expect: zip created
- [ ] Prompt: `Extract /project.zip to /extracted.`
- [ ] Expect: files extracted
- [ ] Prompt: `List contents of /project.zip.`
- [ ] Expect: archive file list

---

## 9) Web (web_operations)

- [ ] Prompt: `Request https://httpbin.org/get and summarize status + response.`
- [ ] Expect: successful HTTP response
- [ ] Prompt: `Fetch https://example.com title and all links.`
- [ ] Expect: title + links returned
- [ ] Prompt: `Parse RSS feed: https://feeds.bbci.co.uk/news/rss.xml.`
- [ ] Expect: feed items returned

---

## 10) Format Conversion (format_conversion)

- [ ] Prompt: `Convert JSON [{"a":1,"b":2},{"a":3,"b":4}] to CSV.`
- [ ] Expect: CSV output
- [ ] Prompt: `Convert CSV to JSON.`
- [ ] Expect: JSON array output
- [ ] Prompt: `Convert Markdown "# Hello\n\nWorld" to HTML.`
- [ ] Expect: HTML output
- [ ] Prompt: `Encode "Hello World" to Base64, then decode it back.`
- [ ] Expect: both operations correct

---

## 11) Subagent

### folder-organizer
- [ ] Prompt: `Use the folder-organizer subagent to organize /Downloads.`
- [ ] Expect: subagent runs and returns summary (moved files/errors)

---

## 12) Test Report Template

| Module | Cases | Passed | Failed | Notes |
|---|---:|---:|---:|---|
| Core utilities | 7 |  |  |  |
| File management | 7 |  |  |  |
| Office tools | 6 |  |  |  |
| PDF | 5 |  |  |  |
| Media | 4 |  |  |  |
| Data analysis | 3 |  |  |  |
| Archive | 3 |  |  |  |
| Web | 3 |  |  |  |
| Format conversion | 4 |  |  |  |
| Subagent | 1 |  |  |  |
| **Total** | **43** |  |  |  |

---

## 13) Troubleshooting

- Build failure: run `npm install --legacy-peer-deps` then `npm run build`
- Image tool failures: run `npm rebuild sharp`
- Video tool failures: install ffmpeg (macOS: `brew install ffmpeg`)
- Path errors: always use workspace-relative paths (e.g., `/data.csv`)
