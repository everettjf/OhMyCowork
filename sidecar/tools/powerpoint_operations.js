import { tool } from "@langchain/core/tools";
import { z } from "zod";
import pptxgen from "pptxgenjs";
import path from "node:path";

const PowerPointOperationSchema = z.object({
  operation: z.enum(["create"]).describe("The operation to perform"),
  filePath: z.string().describe("Path to the PowerPoint file (relative to workspace)"),
  title: z.string().optional().describe("Presentation title"),
  author: z.string().optional().describe("Author name"),
  slides: z.array(z.object({
    layout: z.enum(["title", "titleAndContent", "twoColumn", "blank"]).optional(),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    content: z.array(z.string()).optional().describe("Bullet points or content"),
    leftContent: z.array(z.string()).optional().describe("Left column content"),
    rightContent: z.array(z.string()).optional().describe("Right column content"),
    notes: z.string().optional().describe("Speaker notes"),
    backgroundColor: z.string().optional().describe("Background color (hex)"),
  })).optional().describe("Slides configuration"),
});

export function createPowerPointOperationsTool({ workspaceRoot, requestId, emitStatus }) {
  return tool(
    async ({ operation, filePath, title, author, slides }) => {
      emitStatus?.({ stage: "tool_start", tool: "powerpoint_operations", detail: { operation, filePath } });

      try {
        const fullPath = path.join(workspaceRoot, filePath);

        if (operation === "create") {
          const pptx = new pptxgen();

          // Set presentation properties
          if (title) pptx.title = title;
          if (author) pptx.author = author;
          pptx.company = "Created with OhMyCowork";

          // Define master slides with consistent styling
          pptx.defineSlideMaster({
            title: "MASTER_SLIDE",
            background: { color: "FFFFFF" },
          });

          if (!slides || slides.length === 0) {
            // Create a default title slide
            const slide = pptx.addSlide();
            slide.addText(title || "Untitled Presentation", {
              x: 0.5,
              y: "40%",
              w: "90%",
              h: 1,
              fontSize: 44,
              bold: true,
              align: "center",
              color: "363636",
            });
          } else {
            for (const slideConfig of slides) {
              const slide = pptx.addSlide();

              // Set background color if specified
              if (slideConfig.backgroundColor) {
                slide.background = { color: slideConfig.backgroundColor.replace("#", "") };
              }

              switch (slideConfig.layout) {
                case "title":
                  // Title slide layout
                  if (slideConfig.title) {
                    slide.addText(slideConfig.title, {
                      x: 0.5,
                      y: "35%",
                      w: "90%",
                      h: 1.5,
                      fontSize: 44,
                      bold: true,
                      align: "center",
                      color: "363636",
                    });
                  }
                  if (slideConfig.subtitle) {
                    slide.addText(slideConfig.subtitle, {
                      x: 0.5,
                      y: "55%",
                      w: "90%",
                      h: 0.75,
                      fontSize: 24,
                      align: "center",
                      color: "666666",
                    });
                  }
                  break;

                case "twoColumn":
                  // Two column layout
                  if (slideConfig.title) {
                    slide.addText(slideConfig.title, {
                      x: 0.5,
                      y: 0.5,
                      w: "90%",
                      h: 0.75,
                      fontSize: 32,
                      bold: true,
                      color: "363636",
                    });
                  }
                  if (slideConfig.leftContent) {
                    slide.addText(
                      slideConfig.leftContent.map((item) => ({
                        text: item,
                        options: { bullet: true, breakLine: true },
                      })),
                      {
                        x: 0.5,
                        y: 1.5,
                        w: 4.5,
                        h: 4,
                        fontSize: 18,
                        color: "363636",
                        valign: "top",
                      }
                    );
                  }
                  if (slideConfig.rightContent) {
                    slide.addText(
                      slideConfig.rightContent.map((item) => ({
                        text: item,
                        options: { bullet: true, breakLine: true },
                      })),
                      {
                        x: 5.25,
                        y: 1.5,
                        w: 4.5,
                        h: 4,
                        fontSize: 18,
                        color: "363636",
                        valign: "top",
                      }
                    );
                  }
                  break;

                case "blank":
                  // Blank slide - just add title if provided
                  if (slideConfig.title) {
                    slide.addText(slideConfig.title, {
                      x: 0.5,
                      y: 0.5,
                      w: "90%",
                      h: 0.75,
                      fontSize: 32,
                      bold: true,
                      color: "363636",
                    });
                  }
                  break;

                case "titleAndContent":
                default:
                  // Title and content layout (default)
                  if (slideConfig.title) {
                    slide.addText(slideConfig.title, {
                      x: 0.5,
                      y: 0.5,
                      w: "90%",
                      h: 0.75,
                      fontSize: 32,
                      bold: true,
                      color: "363636",
                    });
                  }
                  if (slideConfig.content) {
                    slide.addText(
                      slideConfig.content.map((item) => ({
                        text: item,
                        options: { bullet: true, breakLine: true },
                      })),
                      {
                        x: 0.5,
                        y: 1.5,
                        w: 9,
                        h: 4,
                        fontSize: 20,
                        color: "363636",
                        valign: "top",
                      }
                    );
                  }
                  break;
              }

              // Add speaker notes if provided
              if (slideConfig.notes) {
                slide.addNotes(slideConfig.notes);
              }
            }
          }

          await pptx.writeFile({ fileName: fullPath });

          emitStatus?.({ stage: "tool_end", tool: "powerpoint_operations" });
          return `PowerPoint presentation created successfully at ${filePath} with ${slides?.length || 1} slide(s)`;
        }

        throw new Error(`Unknown operation: ${operation}`);
      } catch (error) {
        emitStatus?.({ stage: "tool_error", tool: "powerpoint_operations", detail: { error: error.message } });
        return `Error: ${error.message}`;
      }
    },
    {
      name: "powerpoint_operations",
      description: "Create PowerPoint presentations with multiple slide layouts: title slides, content slides with bullet points, two-column layouts, and blank slides. Supports speaker notes and custom backgrounds.",
      schema: PowerPointOperationSchema,
    }
  );
}
