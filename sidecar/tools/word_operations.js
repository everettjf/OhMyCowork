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
  BorderStyle,
  AlignmentType,
} from "docx";
import fs from "node:fs";
import path from "node:path";

const WordOperationSchema = z.object({
  operation: z.enum(["create", "create_from_template"]).describe("The operation to perform"),
  filePath: z.string().describe("Path to the Word file (relative to workspace)"),
  title: z.string().optional().describe("Document title"),
  content: z.array(z.object({
    type: z.enum(["heading1", "heading2", "heading3", "paragraph", "bullet", "numbered", "table"]),
    text: z.string().optional(),
    items: z.array(z.string()).optional().describe("Items for bullet/numbered lists"),
    rows: z.array(z.array(z.string())).optional().describe("Table rows (first row is header)"),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
  })).optional().describe("Document content blocks"),
});

export function createWordOperationsTool({ workspaceRoot, requestId, emitStatus }) {
  return tool(
    async ({ operation, filePath, title, content }) => {
      emitStatus?.({ stage: "tool_start", tool: "word_operations", detail: { operation, filePath } });

      try {
        const fullPath = path.join(workspaceRoot, filePath);

        if (operation === "create") {
          const children = [];

          // Add title if provided
          if (title) {
            children.push(
              new Paragraph({
                text: title,
                heading: HeadingLevel.TITLE,
                spacing: { after: 400 },
              })
            );
          }

          // Process content blocks
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
                    block.items.forEach((item, index) => {
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
                      })
                    );
                    children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
                  }
                  break;
              }
            }
          }

          const doc = new Document({
            sections: [
              {
                children,
              },
            ],
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

          emitStatus?.({ stage: "tool_end", tool: "word_operations" });
          return `Word document created successfully at ${filePath}`;
        }

        throw new Error(`Unknown operation: ${operation}`);
      } catch (error) {
        emitStatus?.({ stage: "tool_error", tool: "word_operations", detail: { error: error.message } });
        return `Error: ${error.message}`;
      }
    },
    {
      name: "word_operations",
      description: "Create Word documents with headings, paragraphs, bullet lists, numbered lists, and tables. Supports formatting like bold and italic text.",
      schema: WordOperationSchema,
    }
  );
}
