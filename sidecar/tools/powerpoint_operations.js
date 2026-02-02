import { tool } from "@langchain/core/tools";
import { z } from "zod";
import pptxgen from "pptxgenjs";
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

const SlideElementSchema = z.object({
  type: z.enum(["text", "image", "shape", "table", "chart"]),
  // Text options
  text: z.string().optional(),
  x: z.union([z.number(), z.string()]).optional(),
  y: z.union([z.number(), z.string()]).optional(),
  w: z.union([z.number(), z.string()]).optional(),
  h: z.union([z.number(), z.string()]).optional(),
  fontSize: z.number().optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  color: z.string().optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  valign: z.enum(["top", "middle", "bottom"]).optional(),
  // Image options
  imagePath: z.string().optional(),
  // Shape options
  shapeType: z.enum(["rect", "roundRect", "ellipse", "triangle", "line", "arrow"]).optional(),
  fill: z.string().optional(),
  line: z.object({ color: z.string(), width: z.number().optional() }).optional(),
  // Table options
  tableData: z.array(z.array(z.string())).optional(),
  // Chart options
  chartType: z.enum(["bar", "line", "pie", "doughnut", "area"]).optional(),
  chartData: z.array(z.object({
    name: z.string(),
    labels: z.array(z.string()),
    values: z.array(z.number()),
  })).optional(),
  chartTitle: z.string().optional(),
});

const SlideSchema = z.object({
  layout: z.enum(["title", "titleAndContent", "twoColumn", "blank", "sectionHeader", "comparison"]).optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  content: z.array(z.string()).optional(),
  leftContent: z.array(z.string()).optional(),
  rightContent: z.array(z.string()).optional(),
  notes: z.string().optional(),
  backgroundColor: z.string().optional(),
  backgroundImage: z.string().optional(),
  elements: z.array(SlideElementSchema).optional(),
  transition: z.enum(["fade", "push", "wipe", "split", "none"]).optional(),
});

const PowerPointOperationSchema = z.object({
  operation: z.enum(["create", "add_slides", "export_pdf"]).describe("The operation to perform"),
  filePath: z.string().describe("Path to the PowerPoint file (relative to workspace)"),
  title: z.string().optional().describe("Presentation title"),
  author: z.string().optional().describe("Author name"),
  subject: z.string().optional().describe("Presentation subject"),
  slides: z.array(SlideSchema).optional().describe("Slides configuration"),
  theme: z.object({
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    fontFamily: z.string().optional(),
  }).optional().describe("Theme settings"),
  masterSlide: z.object({
    backgroundColor: z.string().optional(),
    logo: z.string().optional(),
    footerText: z.string().optional(),
  }).optional().describe("Master slide settings"),
});

export function createPowerPointOperationsTool({ workspaceRoot, requestId, emitStatus }) {
  const notify = (stage, detail) => {
    if (typeof emitStatus === "function") {
      emitStatus({ stage, tool: "powerpoint_operations", detail, requestId });
    }
  };

  return tool(
    async (params) => {
      const {
        operation,
        filePath,
        title,
        author,
        subject,
        slides,
        theme,
        masterSlide,
      } = params;

      notify("tool_start", { operation, filePath });

      try {
        const fullPath = resolveWorkspacePath(workspaceRoot, filePath);

        if (operation === "create" || operation === "add_slides") {
          const pptx = new pptxgen();

          // Set presentation properties
          if (title) pptx.title = title;
          if (author) pptx.author = author;
          if (subject) pptx.subject = subject;
          pptx.company = "Created with OhMyCowork";

          // Define master slide
          const masterConfig = {
            title: "MASTER_SLIDE",
            background: { color: masterSlide?.backgroundColor?.replace("#", "") || "FFFFFF" },
          };

          // Add footer to master if specified
          if (masterSlide?.footerText) {
            masterConfig.slideNumber = { x: 0.3, y: "95%", color: "666666", fontSize: 10 };
          }

          pptx.defineSlideMaster(masterConfig);

          if (!slides || slides.length === 0) {
            const slide = pptx.addSlide();
            slide.addText(title || "Untitled Presentation", {
              x: 0.5,
              y: "40%",
              w: "90%",
              h: 1,
              fontSize: 44,
              bold: true,
              align: "center",
              color: theme?.primaryColor?.replace("#", "") || "363636",
            });
          } else {
            for (const slideConfig of slides) {
              const slide = pptx.addSlide();

              // Set background
              if (slideConfig.backgroundColor) {
                slide.background = { color: slideConfig.backgroundColor.replace("#", "") };
              }
              if (slideConfig.backgroundImage) {
                const bgPath = resolveWorkspacePath(workspaceRoot, slideConfig.backgroundImage);
                if (fs.existsSync(bgPath)) {
                  slide.background = { path: bgPath };
                }
              }

              // Set transition
              if (slideConfig.transition && slideConfig.transition !== "none") {
                slide.transition = { type: slideConfig.transition };
              }

              // Add master slide footer
              if (masterSlide?.footerText) {
                slide.addText(masterSlide.footerText, {
                  x: 0.5,
                  y: "93%",
                  w: "40%",
                  h: 0.3,
                  fontSize: 10,
                  color: "666666",
                });
              }

              // Handle different layouts
              switch (slideConfig.layout) {
                case "title":
                  if (slideConfig.title) {
                    slide.addText(slideConfig.title, {
                      x: 0.5, y: "35%", w: "90%", h: 1.5,
                      fontSize: 44, bold: true, align: "center",
                      color: theme?.primaryColor?.replace("#", "") || "363636",
                    });
                  }
                  if (slideConfig.subtitle) {
                    slide.addText(slideConfig.subtitle, {
                      x: 0.5, y: "55%", w: "90%", h: 0.75,
                      fontSize: 24, align: "center",
                      color: theme?.secondaryColor?.replace("#", "") || "666666",
                    });
                  }
                  break;

                case "sectionHeader":
                  if (slideConfig.title) {
                    slide.addText(slideConfig.title, {
                      x: 0.5, y: "40%", w: "90%", h: 1,
                      fontSize: 36, bold: true, align: "center",
                      color: theme?.primaryColor?.replace("#", "") || "363636",
                    });
                  }
                  // Add decorative line
                  slide.addShape("rect", {
                    x: "30%", y: "52%", w: "40%", h: 0.05,
                    fill: { color: theme?.secondaryColor?.replace("#", "") || "CCCCCC" },
                  });
                  break;

                case "twoColumn":
                  if (slideConfig.title) {
                    slide.addText(slideConfig.title, {
                      x: 0.5, y: 0.5, w: "90%", h: 0.75,
                      fontSize: 32, bold: true,
                      color: theme?.primaryColor?.replace("#", "") || "363636",
                    });
                  }
                  if (slideConfig.leftContent) {
                    slide.addText(
                      slideConfig.leftContent.map((item) => ({
                        text: item,
                        options: { bullet: true, breakLine: true },
                      })),
                      { x: 0.5, y: 1.5, w: 4.5, h: 4, fontSize: 18, color: "363636", valign: "top" }
                    );
                  }
                  if (slideConfig.rightContent) {
                    slide.addText(
                      slideConfig.rightContent.map((item) => ({
                        text: item,
                        options: { bullet: true, breakLine: true },
                      })),
                      { x: 5.25, y: 1.5, w: 4.5, h: 4, fontSize: 18, color: "363636", valign: "top" }
                    );
                  }
                  break;

                case "comparison":
                  if (slideConfig.title) {
                    slide.addText(slideConfig.title, {
                      x: 0.5, y: 0.5, w: "90%", h: 0.75,
                      fontSize: 32, bold: true,
                      color: theme?.primaryColor?.replace("#", "") || "363636",
                    });
                  }
                  // Left box
                  slide.addShape("roundRect", {
                    x: 0.5, y: 1.4, w: 4.5, h: 4.2,
                    fill: { color: "F5F5F5" },
                    line: { color: "DDDDDD", width: 1 },
                  });
                  // Right box
                  slide.addShape("roundRect", {
                    x: 5.25, y: 1.4, w: 4.5, h: 4.2,
                    fill: { color: "F5F5F5" },
                    line: { color: "DDDDDD", width: 1 },
                  });
                  if (slideConfig.leftContent) {
                    slide.addText(
                      slideConfig.leftContent.map((item) => ({
                        text: item,
                        options: { bullet: true, breakLine: true },
                      })),
                      { x: 0.7, y: 1.6, w: 4.1, h: 3.8, fontSize: 16, color: "363636", valign: "top" }
                    );
                  }
                  if (slideConfig.rightContent) {
                    slide.addText(
                      slideConfig.rightContent.map((item) => ({
                        text: item,
                        options: { bullet: true, breakLine: true },
                      })),
                      { x: 5.45, y: 1.6, w: 4.1, h: 3.8, fontSize: 16, color: "363636", valign: "top" }
                    );
                  }
                  break;

                case "blank":
                  if (slideConfig.title) {
                    slide.addText(slideConfig.title, {
                      x: 0.5, y: 0.5, w: "90%", h: 0.75,
                      fontSize: 32, bold: true,
                      color: theme?.primaryColor?.replace("#", "") || "363636",
                    });
                  }
                  break;

                case "titleAndContent":
                default:
                  if (slideConfig.title) {
                    slide.addText(slideConfig.title, {
                      x: 0.5, y: 0.5, w: "90%", h: 0.75,
                      fontSize: 32, bold: true,
                      color: theme?.primaryColor?.replace("#", "") || "363636",
                    });
                  }
                  if (slideConfig.content) {
                    slide.addText(
                      slideConfig.content.map((item) => ({
                        text: item,
                        options: { bullet: true, breakLine: true },
                      })),
                      { x: 0.5, y: 1.5, w: 9, h: 4, fontSize: 20, color: "363636", valign: "top" }
                    );
                  }
                  break;
              }

              // Add custom elements
              if (slideConfig.elements) {
                for (const element of slideConfig.elements) {
                  const baseOpts = {
                    x: element.x ?? 1,
                    y: element.y ?? 1,
                    w: element.w ?? 3,
                    h: element.h ?? 1,
                  };

                  switch (element.type) {
                    case "text":
                      slide.addText(element.text || "", {
                        ...baseOpts,
                        fontSize: element.fontSize || 18,
                        bold: element.bold,
                        italic: element.italic,
                        color: element.color?.replace("#", "") || "363636",
                        align: element.align || "left",
                        valign: element.valign || "top",
                      });
                      break;

                    case "image":
                      if (element.imagePath) {
                        const imgPath = resolveWorkspacePath(workspaceRoot, element.imagePath);
                        if (fs.existsSync(imgPath)) {
                          slide.addImage({
                            path: imgPath,
                            ...baseOpts,
                          });
                        }
                      }
                      break;

                    case "shape":
                      const shapeMap = {
                        rect: "rect",
                        roundRect: "roundRect",
                        ellipse: "ellipse",
                        triangle: "triangle",
                        line: "line",
                        arrow: "rightArrow",
                      };
                      slide.addShape(shapeMap[element.shapeType] || "rect", {
                        ...baseOpts,
                        fill: element.fill ? { color: element.fill.replace("#", "") } : undefined,
                        line: element.line ? {
                          color: element.line.color?.replace("#", ""),
                          width: element.line.width || 1,
                        } : undefined,
                      });
                      break;

                    case "table":
                      if (element.tableData && element.tableData.length > 0) {
                        const tableRows = element.tableData.map((row, rowIndex) =>
                          row.map((cell) => ({
                            text: cell,
                            options: rowIndex === 0 ? {
                              bold: true,
                              fill: { color: "E0E0E0" },
                            } : {},
                          }))
                        );
                        slide.addTable(tableRows, {
                          ...baseOpts,
                          border: { type: "solid", color: "CCCCCC", pt: 1 },
                          fontFace: theme?.fontFamily || "Arial",
                          fontSize: 14,
                        });
                      }
                      break;

                    case "chart":
                      if (element.chartData && element.chartData.length > 0) {
                        const chartTypeMap = {
                          bar: pptx.ChartType.bar,
                          line: pptx.ChartType.line,
                          pie: pptx.ChartType.pie,
                          doughnut: pptx.ChartType.doughnut,
                          area: pptx.ChartType.area,
                        };
                        slide.addChart(chartTypeMap[element.chartType] || pptx.ChartType.bar, element.chartData, {
                          ...baseOpts,
                          showTitle: !!element.chartTitle,
                          title: element.chartTitle,
                          showLegend: true,
                          legendPos: "r",
                        });
                      }
                      break;
                  }
                }
              }

              // Add speaker notes
              if (slideConfig.notes) {
                slide.addNotes(slideConfig.notes);
              }
            }
          }

          await pptx.writeFile({ fileName: fullPath });

          notify("tool_end", { operation });
          return `PowerPoint presentation created successfully at ${filePath} with ${slides?.length || 1} slide(s)`;
        }

        throw new Error(`Unknown operation: ${operation}`);
      } catch (error) {
        notify("tool_error", { error: error.message });
        return `Error: ${error.message}`;
      }
    },
    {
      name: "powerpoint_operations",
      description: "Create PowerPoint presentations with multiple layouts (title, content, two-column, comparison, section header, blank), custom elements (text, images, shapes, tables, charts), themes, master slides, transitions, and speaker notes.",
      schema: PowerPointOperationSchema,
    }
  );
}
