// @ts-nocheck
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  ImageRun,
  ExternalHyperlink,
  PageBreak,
} from "docx";
import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import MarkdownIt from "markdown-it";
import { ToolContext, createNotifier, resolveWorkspacePath } from "./types.js";

interface ContentBlock {
  type: "heading1" | "heading2" | "heading3" | "paragraph" | "bullet" | "numbered" | "table" | "pageBreak" | "link";
  text?: string;
  items?: string[];
  rows?: string[][];
  bold?: boolean;
  italic?: boolean;
  url?: string;
}

interface WordOperationParams {
  operation: string;
  filePath: string;
  title?: string;
  content?: ContentBlock[];
  templatePath?: string;
  templateData?: Record<string, unknown>;
  markdown?: string;
  headerText?: string;
  footerText?: string;
  imagePath?: string;
  imageWidth?: number;
  imageHeight?: number;
}

const WordOperationSchema = z.object({
  operation: z.enum([
    "create",
    "read",
    "from_template",
    "to_html",
    "from_markdown",
    "add_header_footer",
    "add_image",
  ]).describe("The operation to perform"),
  filePath: z.string().describe("Path to the Word file (relative to workspace)"),
  title: z.string().optional().describe("Document title"),
  content: z.array(z.object({
    type: z.enum(["heading1", "heading2", "heading3", "paragraph", "bullet", "numbered", "table", "pageBreak", "link"]),
    text: z.string().optional(),
    items: z.array(z.string()).optional().describe("Items for bullet/numbered lists"),
    rows: z.array(z.array(z.string())).optional().describe("Table rows (first row is header)"),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    url: z.string().optional().describe("URL for links"),
  })).optional().describe("Document content blocks"),
  templatePath: z.string().optional().describe("Path to template file"),
  templateData: z.record(z.unknown()).optional().describe("Data to fill into template"),
  markdown: z.string().optional().describe("Markdown content to convert"),
  headerText: z.string().optional().describe("Header text"),
  footerText: z.string().optional().describe("Footer text"),
  imagePath: z.string().optional().describe("Path to image file"),
  imageWidth: z.number().optional().describe("Image width in pixels"),
  imageHeight: z.number().optional().describe("Image height in pixels"),
});

export function createWordOperationsTool({ workspaceRoot, requestId, emitStatus }: ToolContext) {
  const notify = createNotifier("word_operations", emitStatus, requestId);

  return tool(
    async (params: WordOperationParams) => {
      const {
        operation,
        filePath,
        title,
        content,
        templatePath,
        templateData,
        markdown,
        headerText,
        footerText,
        imagePath,
        imageWidth,
        imageHeight,
      } = params;

      notify("tool_start", { operation, filePath });

      try {
        if (!workspaceRoot) {
          throw new Error("workspaceRoot is required");
        }

        const fullPath = resolveWorkspacePath(workspaceRoot, filePath);

        switch (operation) {
          case "create": {
            const children: Paragraph[] = [];

            if (title) {
              children.push(
                new Paragraph({
                  text: title,
                  heading: HeadingLevel.TITLE,
                  spacing: { after: 400 },
                })
              );
            }

            if (content) {
              for (const block of content) {
                switch (block.type) {
                  case "heading1":
                    children.push(
                      new Paragraph({
                        text: block.text || "",
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 400, after: 200 },
                      })
                    );
                    break;

                  case "heading2":
                    children.push(
                      new Paragraph({
                        text: block.text || "",
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 300, after: 150 },
                      })
                    );
                    break;

                  case "heading3":
                    children.push(
                      new Paragraph({
                        text: block.text || "",
                        heading: HeadingLevel.HEADING_3,
                        spacing: { before: 200, after: 100 },
                      })
                    );
                    break;

                  case "paragraph":
                    children.push(
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: block.text || "",
                            bold: block.bold,
                            italics: block.italic,
                          }),
                        ],
                        spacing: { after: 200 },
                      })
                    );
                    break;

                  case "bullet":
                    if (block.items) {
                      block.items.forEach((item) => {
                        children.push(
                          new Paragraph({
                            text: item,
                            bullet: { level: 0 },
                            spacing: { after: 100 },
                          })
                        );
                      });
                    }
                    break;

                  case "numbered":
                    if (block.items) {
                      block.items.forEach((item) => {
                        children.push(
                          new Paragraph({
                            text: item,
                            numbering: { reference: "default-numbering", level: 0 },
                            spacing: { after: 100 },
                          })
                        );
                      });
                    }
                    break;

                  case "table":
                    if (block.rows && block.rows.length > 0) {
                      const tableRows = block.rows.map((row, rowIndex) => {
                        return new TableRow({
                          children: row.map((cell) => {
                            return new TableCell({
                              children: [new Paragraph({ text: cell })],
                              width: { size: 100 / row.length, type: WidthType.PERCENTAGE },
                              shading: rowIndex === 0 ? { fill: "E0E0E0" } : undefined,
                            });
                          }),
                        });
                      });

                      children.push(
                        new Table({
                          rows: tableRows,
                          width: { size: 100, type: WidthType.PERCENTAGE },
                        }) as unknown as Paragraph
                      );
                      children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
                    }
                    break;

                  case "pageBreak":
                    children.push(
                      new Paragraph({
                        children: [new PageBreak()],
                      })
                    );
                    break;

                  case "link":
                    if (block.url && block.text) {
                      children.push(
                        new Paragraph({
                          children: [
                            new ExternalHyperlink({
                              children: [
                                new TextRun({
                                  text: block.text,
                                  style: "Hyperlink",
                                }),
                              ],
                              link: block.url,
                            }),
                          ],
                          spacing: { after: 200 },
                        })
                      );
                    }
                    break;
                }
              }
            }

            const doc = new Document({
              sections: [{ children }],
              numbering: {
                config: [
                  {
                    reference: "default-numbering",
                    levels: [
                      {
                        level: 0,
                        format: "decimal",
                        text: "%1.",
                        alignment: AlignmentType.START,
                      },
                    ],
                  },
                ],
              },
            });

            const buffer = await Packer.toBuffer(doc);
            fs.writeFileSync(fullPath, buffer);

            notify("tool_end", { operation });
            return `Word document created successfully at ${filePath}`;
          }

          case "read": {
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }

            const result = await mammoth.extractRawText({ path: fullPath });
            const text = result.value;

            notify("tool_end", { operation });
            return JSON.stringify({
              filePath,
              textContent: text.slice(0, 10000),
              textLength: text.length,
              hasMessages: result.messages.length > 0,
              messages: result.messages.slice(0, 5),
            }, null, 2);
          }

          case "from_template": {
            if (!templatePath) {
              throw new Error("templatePath is required");
            }
            const templateFullPath = resolveWorkspacePath(workspaceRoot, templatePath);
            if (!fs.existsSync(templateFullPath)) {
              throw new Error(`Template not found: ${templatePath}`);
            }

            const templateContent = fs.readFileSync(templateFullPath, "binary");
            const zip = new PizZip(templateContent);
            const doc = new Docxtemplater(zip, {
              paragraphLoop: true,
              linebreaks: true,
            });

            doc.render(templateData || {});

            const buffer = doc.getZip().generate({
              type: "nodebuffer",
              compression: "DEFLATE",
            });

            fs.writeFileSync(fullPath, buffer);

            notify("tool_end", { operation });
            return `Document created from template at ${filePath}`;
          }

          case "to_html": {
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }

            const result = await mammoth.convertToHtml({ path: fullPath });
            const htmlOutput = templatePath
              ? resolveWorkspacePath(workspaceRoot, templatePath)
              : fullPath.replace(/\.docx?$/i, ".html");

            const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Converted Document</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f4f4f4; }
  </style>
</head>
<body>
${result.value}
</body>
</html>`;

            fs.writeFileSync(htmlOutput, html);

            notify("tool_end", { operation });
            return `Document converted to HTML at ${path.relative(workspaceRoot, htmlOutput)}`;
          }

          case "from_markdown": {
            if (!markdown) {
              throw new Error("markdown content is required");
            }

            const md = new MarkdownIt();
            const tokens = md.parse(markdown, {});

            const children: Paragraph[] = [];
            let listType: "bullet" | "ordered" | null = null;

            for (const token of tokens) {
              if (token.type === "heading_open") {
                const level = parseInt(token.tag.replace("h", ""));
                const textToken = tokens[tokens.indexOf(token) + 1];
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
                const textToken = tokens[tokens.indexOf(token) + 1];
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
                const contentIndex = tokens.indexOf(token) + 2;
                const contentToken = tokens[contentIndex];
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
                config: [
                  {
                    reference: "default-numbering",
                    levels: [
                      {
                        level: 0,
                        format: "decimal",
                        text: "%1.",
                        alignment: AlignmentType.START,
                      },
                    ],
                  },
                ],
              },
            });

            const buffer = await Packer.toBuffer(doc);
            fs.writeFileSync(fullPath, buffer);

            notify("tool_end", { operation });
            return `Markdown converted to Word document at ${filePath}`;
          }

          case "add_header_footer": {
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }

            const textResult = await mammoth.extractRawText({ path: fullPath });
            const existingText = textResult.value;

            const children = existingText.split("\n").filter((line: string) => line.trim()).map((line: string) =>
              new Paragraph({
                text: line,
                spacing: { after: 200 },
              })
            );

            const doc = new Document({
              sections: [
                {
                  headers: {
                    default: new Header({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: headerText || "",
                              bold: true,
                            }),
                          ],
                          alignment: AlignmentType.CENTER,
                        }),
                      ],
                    }),
                  },
                  footers: {
                    default: new Footer({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: footerText || "Page ",
                            }),
                            new TextRun({
                              children: [PageNumber.CURRENT],
                            }),
                          ],
                          alignment: AlignmentType.CENTER,
                        }),
                      ],
                    }),
                  },
                  children,
                },
              ],
            });

            const buffer = await Packer.toBuffer(doc);
            fs.writeFileSync(fullPath, buffer);

            notify("tool_end", { operation });
            return `Header and footer added to ${filePath}`;
          }

          case "add_image": {
            if (!imagePath) {
              throw new Error("imagePath is required");
            }

            const imageFullPath = resolveWorkspacePath(workspaceRoot, imagePath);
            if (!fs.existsSync(imageFullPath)) {
              throw new Error(`Image not found: ${imagePath}`);
            }

            const imageBuffer = fs.readFileSync(imageFullPath);

            const docChildren: (Paragraph | null)[] = [
              title ? new Paragraph({
                text: title,
                heading: HeadingLevel.TITLE,
                spacing: { after: 400 },
              }) : null,
              new Paragraph({
                children: [
                  new ImageRun({
                    data: imageBuffer,
                    transformation: {
                      width: imageWidth || 400,
                      height: imageHeight || 300,
                    },
                    type: "png",
                  }),
                ],
              }),
            ];

            const doc = new Document({
              sections: [
                {
                  children: docChildren.filter((c): c is Paragraph => c !== null),
                },
              ],
            });

            const buffer = await Packer.toBuffer(doc);
            fs.writeFileSync(fullPath, buffer);

            notify("tool_end", { operation });
            return `Image added to document at ${filePath}`;
          }

          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      } catch (error) {
        const err = error as Error;
        notify("tool_error", { error: err.message });
        return `Error: ${err.message}`;
      }
    },
    {
      name: "word_operations",
      description: "Comprehensive Word document operations: create with rich formatting, read text, generate from templates, convert to/from HTML and Markdown, add headers/footers, and insert images.",
      schema: WordOperationSchema,
    }
  );
}
