// @ts-nocheck
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import PDFParser from "pdf-parse";
import fs from "node:fs";
import path from "node:path";
import { ToolContext, createNotifier, resolveWorkspacePath } from "./types.js";

interface ContentItem {
  type: "text" | "heading" | "paragraph" | "image" | "pageBreak";
  text?: string;
  x?: number;
  y?: number;
  fontSize?: number;
  color?: { r: number; g: number; b: number };
  imagePath?: string;
  imageWidth?: number;
  imageHeight?: number;
}

interface SplitRange {
  start: number;
  end: number;
}

interface PDFOperationParams {
  operation: string;
  filePath: string;
  content?: ContentItem[];
  pageSize?: "A4" | "Letter" | "Legal";
  mergeFiles?: string[];
  splitPages?: number[];
  splitRange?: SplitRange;
  outputPath?: string;
  watermarkText?: string;
  watermarkOpacity?: number;
  watermarkRotation?: number;
  pageNumberPosition?: "bottom-center" | "bottom-right" | "top-center" | "top-right";
  pageNumberFormat?: string;
  rotationDegrees?: number;
  rotatePages?: number[];
}

const PDFOperationSchema = z.object({
  operation: z.enum([
    "create",
    "merge",
    "split",
    "extract_text",
    "add_watermark",
    "add_page_numbers",
    "rotate_pages",
    "get_info",
    "extract_pages",
    "compress",
  ]).describe("The operation to perform"),
  filePath: z.string().describe("Path to the PDF file (relative to workspace)"),
  // Create options
  content: z.array(z.object({
    type: z.enum(["text", "heading", "paragraph", "image", "pageBreak"]),
    text: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    fontSize: z.number().optional(),
    color: z.object({ r: z.number(), g: z.number(), b: z.number() }).optional(),
    imagePath: z.string().optional(),
    imageWidth: z.number().optional(),
    imageHeight: z.number().optional(),
  })).optional().describe("Content for creating PDF"),
  pageSize: z.enum(["A4", "Letter", "Legal"]).optional(),
  // Merge options
  mergeFiles: z.array(z.string()).optional().describe("Files to merge"),
  // Split options
  splitPages: z.array(z.number()).optional().describe("Page numbers to extract (1-indexed)"),
  splitRange: z.object({
    start: z.number(),
    end: z.number(),
  }).optional().describe("Page range to extract"),
  outputPath: z.string().optional().describe("Output file path"),
  // Watermark options
  watermarkText: z.string().optional(),
  watermarkOpacity: z.number().optional(),
  watermarkRotation: z.number().optional(),
  // Page number options
  pageNumberPosition: z.enum(["bottom-center", "bottom-right", "top-center", "top-right"]).optional(),
  pageNumberFormat: z.string().optional().describe("Format like 'Page {n} of {total}'"),
  // Rotation options
  rotationDegrees: z.number().optional(),
  rotatePages: z.array(z.number()).optional().describe("Specific pages to rotate (1-indexed, empty = all)"),
});

export function createPDFOperationsTool({ workspaceRoot, requestId, emitStatus }: ToolContext) {
  const notify = createNotifier("pdf_operations", emitStatus, requestId);

  return tool(
    async (params: PDFOperationParams) => {
      const {
        operation,
        filePath,
        content,
        pageSize,
        mergeFiles,
        splitPages,
        splitRange,
        outputPath,
        watermarkText,
        watermarkOpacity,
        watermarkRotation,
        pageNumberPosition,
        pageNumberFormat,
        rotationDegrees,
        rotatePages,
      } = params;

      notify("tool_start", { operation, filePath });

      try {
        if (!workspaceRoot) {
          throw new Error("workspaceRoot is required");
        }

        const fullPath = resolveWorkspacePath(workspaceRoot, filePath);

        switch (operation) {
          case "create": {
            const pdfDoc = await PDFDocument.create();
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

            // Page dimensions
            const pageSizes: Record<string, [number, number]> = {
              A4: [595.28, 841.89],
              Letter: [612, 792],
              Legal: [612, 1008],
            };
            const [pageWidth, pageHeight] = pageSizes[pageSize || "A4"];

            let page = pdfDoc.addPage([pageWidth, pageHeight]);
            let yPosition = pageHeight - 50;
            const margin = 50;
            const lineHeight = 20;

            if (content) {
              for (const item of content) {
                switch (item.type) {
                  case "heading":
                    if (yPosition < 100) {
                      page = pdfDoc.addPage([pageWidth, pageHeight]);
                      yPosition = pageHeight - 50;
                    }
                    page.drawText(item.text || "", {
                      x: item.x ?? margin,
                      y: yPosition,
                      size: item.fontSize || 24,
                      font: boldFont,
                      color: item.color ? rgb(item.color.r, item.color.g, item.color.b) : rgb(0, 0, 0),
                    });
                    yPosition -= (item.fontSize || 24) + 15;
                    break;

                  case "paragraph":
                  case "text":
                    const words = (item.text || "").split(" ");
                    let line = "";
                    const maxWidth = pageWidth - margin * 2;
                    const fontSize = item.fontSize || 12;

                    for (const word of words) {
                      const testLine = line + (line ? " " : "") + word;
                      const textWidth = font.widthOfTextAtSize(testLine, fontSize);

                      if (textWidth > maxWidth) {
                        if (yPosition < 50) {
                          page = pdfDoc.addPage([pageWidth, pageHeight]);
                          yPosition = pageHeight - 50;
                        }
                        page.drawText(line, {
                          x: item.x ?? margin,
                          y: yPosition,
                          size: fontSize,
                          font,
                          color: item.color ? rgb(item.color.r, item.color.g, item.color.b) : rgb(0, 0, 0),
                        });
                        yPosition -= lineHeight;
                        line = word;
                      } else {
                        line = testLine;
                      }
                    }
                    if (line) {
                      if (yPosition < 50) {
                        page = pdfDoc.addPage([pageWidth, pageHeight]);
                        yPosition = pageHeight - 50;
                      }
                      page.drawText(line, {
                        x: item.x ?? margin,
                        y: yPosition,
                        size: fontSize,
                        font,
                        color: item.color ? rgb(item.color.r, item.color.g, item.color.b) : rgb(0, 0, 0),
                      });
                      yPosition -= lineHeight;
                    }
                    yPosition -= 10;
                    break;

                  case "image":
                    if (item.imagePath) {
                      const imgFullPath = resolveWorkspacePath(workspaceRoot, item.imagePath);
                      if (fs.existsSync(imgFullPath)) {
                        const imgBytes = fs.readFileSync(imgFullPath);
                        let image;
                        if (item.imagePath.toLowerCase().endsWith(".png")) {
                          image = await pdfDoc.embedPng(imgBytes);
                        } else {
                          image = await pdfDoc.embedJpg(imgBytes);
                        }
                        const imgWidth = item.imageWidth || 200;
                        const imgHeight = item.imageHeight || (imgWidth * image.height / image.width);

                        if (yPosition - imgHeight < 50) {
                          page = pdfDoc.addPage([pageWidth, pageHeight]);
                          yPosition = pageHeight - 50;
                        }
                        page.drawImage(image, {
                          x: item.x ?? margin,
                          y: yPosition - imgHeight,
                          width: imgWidth,
                          height: imgHeight,
                        });
                        yPosition -= imgHeight + 20;
                      }
                    }
                    break;

                  case "pageBreak":
                    page = pdfDoc.addPage([pageWidth, pageHeight]);
                    yPosition = pageHeight - 50;
                    break;
                }
              }
            }

            const pdfBytes = await pdfDoc.save();
            fs.writeFileSync(fullPath, pdfBytes);

            notify("tool_end", { operation });
            return `PDF created successfully at ${filePath}`;
          }

          case "merge": {
            if (!mergeFiles || mergeFiles.length === 0) {
              throw new Error("mergeFiles array is required");
            }

            const mergedPdf = await PDFDocument.create();

            for (const file of mergeFiles) {
              const fileFullPath = resolveWorkspacePath(workspaceRoot, file);
              if (!fs.existsSync(fileFullPath)) continue;

              const pdfBytes = fs.readFileSync(fileFullPath);
              const pdf = await PDFDocument.load(pdfBytes);
              const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
              pages.forEach((page) => mergedPdf.addPage(page));
            }

            const mergedBytes = await mergedPdf.save();
            fs.writeFileSync(fullPath, mergedBytes);

            notify("tool_end", { operation });
            return `${mergeFiles.length} PDF files merged into ${filePath}`;
          }

          case "split": {
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }

            const pdfBytes = fs.readFileSync(fullPath);
            const pdf = await PDFDocument.load(pdfBytes);
            const totalPages = pdf.getPageCount();

            let pagesToExtract: number[] = [];
            if (splitPages && splitPages.length > 0) {
              pagesToExtract = splitPages.map((p) => p - 1).filter((p) => p >= 0 && p < totalPages);
            } else if (splitRange) {
              for (let i = splitRange.start - 1; i < Math.min(splitRange.end, totalPages); i++) {
                if (i >= 0) pagesToExtract.push(i);
              }
            }

            if (pagesToExtract.length === 0) {
              throw new Error("No valid pages to extract");
            }

            const newPdf = await PDFDocument.create();
            const pages = await newPdf.copyPages(pdf, pagesToExtract);
            pages.forEach((page) => newPdf.addPage(page));

            const output = outputPath
              ? resolveWorkspacePath(workspaceRoot, outputPath)
              : fullPath.replace(".pdf", "_split.pdf");

            const newPdfBytes = await newPdf.save();
            fs.writeFileSync(output, newPdfBytes);

            notify("tool_end", { operation });
            return `Extracted ${pagesToExtract.length} pages to ${path.relative(workspaceRoot, output)}`;
          }

          case "extract_text": {
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }

            const dataBuffer = fs.readFileSync(fullPath);
            const data = await PDFParser(dataBuffer);

            notify("tool_end", { operation });
            return JSON.stringify({
              filePath,
              pageCount: data.numpages,
              textLength: data.text.length,
              text: data.text.slice(0, 10000), // Limit output
              info: data.info,
            }, null, 2);
          }

          case "add_watermark": {
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }
            if (!watermarkText) {
              throw new Error("watermarkText is required");
            }

            const pdfBytes = fs.readFileSync(fullPath);
            const pdf = await PDFDocument.load(pdfBytes);
            const font = await pdf.embedFont(StandardFonts.HelveticaBold);
            const pages = pdf.getPages();

            for (const page of pages) {
              const { width, height } = page.getSize();
              const fontSize = 50;
              const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);

              page.drawText(watermarkText, {
                x: (width - textWidth) / 2,
                y: height / 2,
                size: fontSize,
                font,
                color: rgb(0.75, 0.75, 0.75),
                opacity: watermarkOpacity ?? 0.3,
                rotate: degrees(watermarkRotation ?? -45),
              });
            }

            const output = outputPath
              ? resolveWorkspacePath(workspaceRoot, outputPath)
              : fullPath;

            const modifiedBytes = await pdf.save();
            fs.writeFileSync(output, modifiedBytes);

            notify("tool_end", { operation });
            return `Watermark added to ${pages.length} pages`;
          }

          case "add_page_numbers": {
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }

            const pdfBytes = fs.readFileSync(fullPath);
            const pdf = await PDFDocument.load(pdfBytes);
            const font = await pdf.embedFont(StandardFonts.Helvetica);
            const pages = pdf.getPages();
            const totalPages = pages.length;

            pages.forEach((page, index) => {
              const { width, height } = page.getSize();
              const pageNum = index + 1;
              const format = pageNumberFormat || "Page {n} of {total}";
              const text = format.replace("{n}", pageNum.toString()).replace("{total}", totalPages.toString());
              const textWidth = font.widthOfTextAtSize(text, 10);

              let x: number, y: number;
              switch (pageNumberPosition || "bottom-center") {
                case "bottom-right":
                  x = width - textWidth - 40;
                  y = 30;
                  break;
                case "top-center":
                  x = (width - textWidth) / 2;
                  y = height - 30;
                  break;
                case "top-right":
                  x = width - textWidth - 40;
                  y = height - 30;
                  break;
                case "bottom-center":
                default:
                  x = (width - textWidth) / 2;
                  y = 30;
                  break;
              }

              page.drawText(text, {
                x,
                y,
                size: 10,
                font,
                color: rgb(0.3, 0.3, 0.3),
              });
            });

            const output = outputPath
              ? resolveWorkspacePath(workspaceRoot, outputPath)
              : fullPath;

            const modifiedBytes = await pdf.save();
            fs.writeFileSync(output, modifiedBytes);

            notify("tool_end", { operation });
            return `Page numbers added to ${totalPages} pages`;
          }

          case "rotate_pages": {
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }

            const pdfBytes = fs.readFileSync(fullPath);
            const pdf = await PDFDocument.load(pdfBytes);
            const pages = pdf.getPages();
            const rotation = rotationDegrees ?? 90;

            const pagesToRotate = rotatePages && rotatePages.length > 0
              ? rotatePages.map((p) => p - 1)
              : pages.map((_, i) => i);

            pagesToRotate.forEach((pageIndex) => {
              if (pageIndex >= 0 && pageIndex < pages.length) {
                const page = pages[pageIndex];
                const currentRotation = page.getRotation().angle;
                page.setRotation(degrees(currentRotation + rotation));
              }
            });

            const output = outputPath
              ? resolveWorkspacePath(workspaceRoot, outputPath)
              : fullPath;

            const modifiedBytes = await pdf.save();
            fs.writeFileSync(output, modifiedBytes);

            notify("tool_end", { operation });
            return `Rotated ${pagesToRotate.length} pages by ${rotation} degrees`;
          }

          case "get_info": {
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }

            const pdfBytes = fs.readFileSync(fullPath);
            const pdf = await PDFDocument.load(pdfBytes);

            const info = {
              pageCount: pdf.getPageCount(),
              title: pdf.getTitle(),
              author: pdf.getAuthor(),
              subject: pdf.getSubject(),
              creator: pdf.getCreator(),
              producer: pdf.getProducer(),
              creationDate: pdf.getCreationDate()?.toISOString(),
              modificationDate: pdf.getModificationDate()?.toISOString(),
              pages: pdf.getPages().map((page, index) => {
                const { width, height } = page.getSize();
                return {
                  page: index + 1,
                  width,
                  height,
                  rotation: page.getRotation().angle,
                };
              }),
            };

            notify("tool_end", { operation });
            return JSON.stringify(info, null, 2);
          }

          case "extract_pages": {
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }
            if (!splitPages || splitPages.length === 0) {
              throw new Error("splitPages array is required");
            }

            const pdfBytes = fs.readFileSync(fullPath);
            const pdf = await PDFDocument.load(pdfBytes);
            const totalPages = pdf.getPageCount();

            const pageIndices = splitPages
              .map((p) => p - 1)
              .filter((p) => p >= 0 && p < totalPages);

            const newPdf = await PDFDocument.create();
            const pages = await newPdf.copyPages(pdf, pageIndices);
            pages.forEach((page) => newPdf.addPage(page));

            const output = outputPath
              ? resolveWorkspacePath(workspaceRoot, outputPath)
              : fullPath.replace(".pdf", "_extracted.pdf");

            const newPdfBytes = await newPdf.save();
            fs.writeFileSync(output, newPdfBytes);

            notify("tool_end", { operation });
            return `Extracted pages ${splitPages.join(", ")} to ${path.relative(workspaceRoot, output)}`;
          }

          case "compress": {
            // Note: pdf-lib doesn't have built-in compression, but saving with options helps
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }

            const pdfBytes = fs.readFileSync(fullPath);
            const originalSize = pdfBytes.length;
            const pdf = await PDFDocument.load(pdfBytes);

            const output = outputPath
              ? resolveWorkspacePath(workspaceRoot, outputPath)
              : fullPath.replace(".pdf", "_compressed.pdf");

            const compressedBytes = await pdf.save({
              useObjectStreams: true,
            });

            fs.writeFileSync(output, compressedBytes);
            const newSize = compressedBytes.length;

            notify("tool_end", { operation });
            return JSON.stringify({
              originalSize,
              compressedSize: newSize,
              reduction: `${(((originalSize - newSize) / originalSize) * 100).toFixed(1)}%`,
              outputPath: path.relative(workspaceRoot, output),
            }, null, 2);
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
      name: "pdf_operations",
      description: "Comprehensive PDF operations: create PDFs with text/images, merge multiple PDFs, split/extract pages, extract text, add watermarks, add page numbers, rotate pages, get document info, and compress PDFs.",
      schema: PDFOperationSchema,
    }
  );
}
