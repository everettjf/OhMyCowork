// @ts-nocheck
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import sharp from "sharp";
import MarkdownIt from "markdown-it";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import Papa from "papaparse";
import fs from "node:fs";
import path from "node:path";

function resolveWorkspacePath(workspaceRoot, targetPath) {
  const cleaned = targetPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const absolute = path.resolve(workspaceRoot, cleaned);
  const relative = path.relative(workspaceRoot, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path escapes workspace root.");
  }
  return absolute;
}

const FormatConversionSchema = z.object({
  operation: z.enum([
    "image_convert",
    "markdown_to_html",
    "markdown_to_docx",
    "html_to_markdown",
    "json_to_csv",
    "csv_to_json",
    "yaml_to_json",
    "json_to_yaml",
    "text_to_base64",
    "base64_to_text",
  ]).describe("The conversion operation to perform"),
  inputPath: z.string().optional().describe("Input file path (workspace-relative)"),
  outputPath: z.string().optional().describe("Output file path (workspace-relative)"),
  inputContent: z.string().optional().describe("Input content for direct conversion"),
  // Image conversion options
  imageFormat: z.enum(["jpeg", "png", "webp", "avif", "gif", "tiff"]).optional(),
  imageQuality: z.number().optional(),
  // Markdown options
  markdownFlavor: z.enum(["github", "commonmark"]).optional(),
});

export function createFormatConversionTool({ workspaceRoot, requestId, emitStatus }) {
  const notify = (stage, detail) => {
    if (typeof emitStatus === "function") {
      emitStatus({ stage, tool: "format_conversion", detail, requestId });
    }
  };

  return tool(
    async (params) => {
      const {
        operation,
        inputPath,
        outputPath,
        inputContent,
        imageFormat,
        imageQuality,
        markdownFlavor,
      } = params;

      notify("tool_start", { operation, inputPath });

      try {
        // Get input content
        let content = inputContent;
        if (!content && inputPath) {
          const fullInputPath = resolveWorkspacePath(workspaceRoot, inputPath);
          if (!fs.existsSync(fullInputPath)) {
            throw new Error(`Input file not found: ${inputPath}`);
          }
          content = fs.readFileSync(fullInputPath, "utf-8");
        }

        switch (operation) {
          case "image_convert": {
            if (!inputPath) {
              throw new Error("inputPath is required for image conversion");
            }
            if (!imageFormat) {
              throw new Error("imageFormat is required");
            }

            const fullInputPath = resolveWorkspacePath(workspaceRoot, inputPath);
            const outputFile = outputPath
              ? resolveWorkspacePath(workspaceRoot, outputPath)
              : fullInputPath.replace(path.extname(fullInputPath), `.${imageFormat}`);

            await sharp(fullInputPath)
              .toFormat(imageFormat, { quality: imageQuality || 80 })
              .toFile(outputFile);

            const inputStat = fs.statSync(fullInputPath);
            const outputStat = fs.statSync(outputFile);

            notify("tool_end", { operation });
            return JSON.stringify({
              operation,
              input: inputPath,
              output: path.relative(workspaceRoot, outputFile),
              format: imageFormat,
              originalSize: inputStat.size,
              newSize: outputStat.size,
            }, null, 2);
          }

          case "markdown_to_html": {
            if (!content) {
              throw new Error("inputContent or inputPath is required");
            }

            const md = new MarkdownIt({
              html: true,
              linkify: true,
              typographer: true,
            });

            const htmlContent = md.render(content);

            const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Converted Document</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    pre { background: #f4f4f4; padding: 15px; overflow-x: auto; border-radius: 5px; }
    code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }
    blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 20px; color: #666; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f4f4f4; }
    img { max-width: 100%; }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;

            if (outputPath) {
              const fullOutputPath = resolveWorkspacePath(workspaceRoot, outputPath);
              fs.writeFileSync(fullOutputPath, html);
            }

            notify("tool_end", { operation });
            return outputPath
              ? JSON.stringify({ operation, output: outputPath, htmlLength: html.length }, null, 2)
              : html.slice(0, 5000);
          }

          case "markdown_to_docx": {
            if (!content) {
              throw new Error("inputContent or inputPath is required");
            }
            if (!outputPath) {
              throw new Error("outputPath is required for DOCX output");
            }

            const md = new MarkdownIt();
            const tokens = md.parse(content, {});

            const children = [];
            let listType = null;

            for (let i = 0; i < tokens.length; i++) {
              const token = tokens[i];

              if (token.type === "heading_open") {
                const level = parseInt(token.tag.replace("h", ""));
                const textToken = tokens[i + 1];
                const headingLevel = level === 1 ? HeadingLevel.HEADING_1
                  : level === 2 ? HeadingLevel.HEADING_2
                  : HeadingLevel.HEADING_3;

                children.push(
                  new Paragraph({
                    text: textToken?.content || "",
                    heading: headingLevel,
                    spacing: { before: 300, after: 150 },
                  })
                );
              } else if (token.type === "paragraph_open") {
                const textToken = tokens[i + 1];
                if (textToken?.content) {
                  children.push(
                    new Paragraph({
                      text: textToken.content,
                      spacing: { after: 200 },
                    })
                  );
                }
              } else if (token.type === "bullet_list_open") {
                listType = "bullet";
              } else if (token.type === "ordered_list_open") {
                listType = "ordered";
              } else if (token.type === "list_item_open") {
                const contentIdx = i + 2;
                const contentToken = tokens[contentIdx];
                if (contentToken?.content) {
                  if (listType === "bullet") {
                    children.push(
                      new Paragraph({
                        text: contentToken.content,
                        bullet: { level: 0 },
                        spacing: { after: 100 },
                      })
                    );
                  } else {
                    children.push(
                      new Paragraph({
                        text: contentToken.content,
                        numbering: { reference: "default-numbering", level: 0 },
                        spacing: { after: 100 },
                      })
                    );
                  }
                }
              } else if (token.type === "bullet_list_close" || token.type === "ordered_list_close") {
                listType = null;
              }
            }

            const doc = new Document({
              sections: [{ children }],
              numbering: {
                config: [{
                  reference: "default-numbering",
                  levels: [{
                    level: 0,
                    format: "decimal",
                    text: "%1.",
                    alignment: AlignmentType.START,
                  }],
                }],
              },
            });

            const buffer = await Packer.toBuffer(doc);
            const fullOutputPath = resolveWorkspacePath(workspaceRoot, outputPath);
            fs.writeFileSync(fullOutputPath, buffer);

            notify("tool_end", { operation });
            return JSON.stringify({
              operation,
              output: outputPath,
              paragraphs: children.length,
            }, null, 2);
          }

          case "html_to_markdown": {
            if (!content) {
              throw new Error("inputContent or inputPath is required");
            }

            // Simple HTML to Markdown conversion
            let markdown = content
              // Headers
              .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n")
              .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n")
              .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n")
              .replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n")
              // Formatting
              .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
              .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
              .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
              .replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*")
              .replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`")
              // Links
              .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
              // Images
              .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, "![$2]($1)")
              .replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, "![]($1)")
              // Lists
              .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
              // Paragraphs
              .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
              // Line breaks
              .replace(/<br\s*\/?>/gi, "\n")
              // Blockquotes
              .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, content) =>
                content.split("\n").map((line) => `> ${line.trim()}`).join("\n") + "\n\n"
              )
              // Remove remaining tags
              .replace(/<[^>]+>/g, "")
              // Fix multiple newlines
              .replace(/\n{3,}/g, "\n\n")
              // Decode HTML entities
              .replace(/&nbsp;/g, " ")
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"')
              .trim();

            if (outputPath) {
              const fullOutputPath = resolveWorkspacePath(workspaceRoot, outputPath);
              fs.writeFileSync(fullOutputPath, markdown);
            }

            notify("tool_end", { operation });
            return outputPath
              ? JSON.stringify({ operation, output: outputPath, length: markdown.length }, null, 2)
              : markdown.slice(0, 5000);
          }

          case "json_to_csv": {
            if (!content) {
              throw new Error("inputContent or inputPath is required");
            }

            const data = JSON.parse(content);
            const arrayData = Array.isArray(data) ? data : [data];
            const csv = Papa.unparse(arrayData);

            if (outputPath) {
              const fullOutputPath = resolveWorkspacePath(workspaceRoot, outputPath);
              fs.writeFileSync(fullOutputPath, csv);
            }

            notify("tool_end", { operation });
            return outputPath
              ? JSON.stringify({ operation, output: outputPath, rows: arrayData.length }, null, 2)
              : csv.slice(0, 5000);
          }

          case "csv_to_json": {
            if (!content) {
              throw new Error("inputContent or inputPath is required");
            }

            const parsed = Papa.parse(content, {
              header: true,
              skipEmptyLines: true,
              dynamicTyping: true,
            });

            const json = JSON.stringify(parsed.data, null, 2);

            if (outputPath) {
              const fullOutputPath = resolveWorkspacePath(workspaceRoot, outputPath);
              fs.writeFileSync(fullOutputPath, json);
            }

            notify("tool_end", { operation });
            return outputPath
              ? JSON.stringify({ operation, output: outputPath, rows: parsed.data.length }, null, 2)
              : json.slice(0, 5000);
          }

          case "yaml_to_json": {
            if (!content) {
              throw new Error("inputContent or inputPath is required");
            }

            // Simple YAML to JSON (basic implementation)
            const lines = content.split("\n");
            const result = {};
            let currentKey = null;
            let currentIndent = 0;
            const stack = [result];

            for (const line of lines) {
              if (line.trim() === "" || line.trim().startsWith("#")) continue;

              const indent = line.search(/\S/);
              const trimmed = line.trim();

              if (trimmed.includes(":")) {
                const [key, ...valueParts] = trimmed.split(":");
                const value = valueParts.join(":").trim();

                if (value) {
                  // Simple key-value
                  let parsedValue = value;
                  if (value === "true") parsedValue = true;
                  else if (value === "false") parsedValue = false;
                  else if (!isNaN(value) && value !== "") parsedValue = Number(value);
                  else if (value.startsWith('"') && value.endsWith('"')) parsedValue = value.slice(1, -1);
                  else if (value.startsWith("'") && value.endsWith("'")) parsedValue = value.slice(1, -1);

                  stack[stack.length - 1][key] = parsedValue;
                } else {
                  // Nested object
                  stack[stack.length - 1][key] = {};
                  stack.push(stack[stack.length - 1][key]);
                }
              }
            }

            const json = JSON.stringify(result, null, 2);

            if (outputPath) {
              const fullOutputPath = resolveWorkspacePath(workspaceRoot, outputPath);
              fs.writeFileSync(fullOutputPath, json);
            }

            notify("tool_end", { operation });
            return outputPath
              ? JSON.stringify({ operation, output: outputPath }, null, 2)
              : json.slice(0, 5000);
          }

          case "json_to_yaml": {
            if (!content) {
              throw new Error("inputContent or inputPath is required");
            }

            const data = JSON.parse(content);

            const toYaml = (obj, indent = 0) => {
              const spaces = "  ".repeat(indent);
              let yaml = "";

              if (Array.isArray(obj)) {
                for (const item of obj) {
                  if (typeof item === "object" && item !== null) {
                    yaml += `${spaces}-\n${toYaml(item, indent + 1)}`;
                  } else {
                    yaml += `${spaces}- ${item}\n`;
                  }
                }
              } else if (typeof obj === "object" && obj !== null) {
                for (const [key, value] of Object.entries(obj)) {
                  if (typeof value === "object" && value !== null) {
                    yaml += `${spaces}${key}:\n${toYaml(value, indent + 1)}`;
                  } else if (typeof value === "string" && (value.includes(":") || value.includes("#"))) {
                    yaml += `${spaces}${key}: "${value}"\n`;
                  } else {
                    yaml += `${spaces}${key}: ${value}\n`;
                  }
                }
              }

              return yaml;
            };

            const yaml = toYaml(data);

            if (outputPath) {
              const fullOutputPath = resolveWorkspacePath(workspaceRoot, outputPath);
              fs.writeFileSync(fullOutputPath, yaml);
            }

            notify("tool_end", { operation });
            return outputPath
              ? JSON.stringify({ operation, output: outputPath }, null, 2)
              : yaml.slice(0, 5000);
          }

          case "text_to_base64": {
            if (!content) {
              throw new Error("inputContent or inputPath is required");
            }

            const base64 = Buffer.from(content).toString("base64");

            if (outputPath) {
              const fullOutputPath = resolveWorkspacePath(workspaceRoot, outputPath);
              fs.writeFileSync(fullOutputPath, base64);
            }

            notify("tool_end", { operation });
            return outputPath
              ? JSON.stringify({ operation, output: outputPath, length: base64.length }, null, 2)
              : base64.slice(0, 5000);
          }

          case "base64_to_text": {
            if (!content) {
              throw new Error("inputContent or inputPath is required");
            }

            const text = Buffer.from(content, "base64").toString("utf-8");

            if (outputPath) {
              const fullOutputPath = resolveWorkspacePath(workspaceRoot, outputPath);
              fs.writeFileSync(fullOutputPath, text);
            }

            notify("tool_end", { operation });
            return outputPath
              ? JSON.stringify({ operation, output: outputPath, length: text.length }, null, 2)
              : text.slice(0, 5000);
          }

          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      } catch (error) {
        notify("tool_error", { error: error.message });
        return `Error: ${error.message}`;
      }
    },
    {
      name: "format_conversion",
      description: "Format conversion tool: convert images between formats, Markdown to HTML/DOCX, HTML to Markdown, JSON to CSV and vice versa, YAML to JSON and vice versa, text to Base64 and vice versa.",
      schema: FormatConversionSchema,
    }
  );
}
