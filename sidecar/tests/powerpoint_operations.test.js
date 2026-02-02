import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestWorkspace,
  cleanupTestWorkspace,
  createMockEmitStatus,
  fileExists,
} from "./helpers.js";
import { createPowerPointOperationsTool } from "../tools/powerpoint_operations.js";

describe("PowerPoint Operations Tool", () => {
  let workspaceRoot;
  let emitStatus;
  let events;
  let tool;

  beforeEach(async () => {
    workspaceRoot = await createTestWorkspace();
    const mock = createMockEmitStatus();
    emitStatus = mock.emitStatus;
    events = mock.events;
    tool = createPowerPointOperationsTool({ workspaceRoot, emitStatus });
  });

  afterEach(async () => {
    await cleanupTestWorkspace(workspaceRoot);
  });

  describe("create", () => {
    it("should create a new presentation with title slide", async () => {
      const result = await tool.invoke({
        operation: "create",
        filePath: "test.pptx",
        title: "My Presentation",
        slides: [
          {
            layout: "title",
            title: "My Presentation",
            subtitle: "A Test Presentation",
          },
        ],
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "test.pptx")).toBe(true);
    });

    it("should create presentation with multiple slides", async () => {
      const result = await tool.invoke({
        operation: "create",
        filePath: "test.pptx",
        slides: [
          {
            layout: "title",
            title: "Title Slide",
            subtitle: "Subtitle",
          },
          {
            layout: "titleAndContent",
            title: "Content Slide",
            content: ["Point 1", "Point 2", "Point 3"],
          },
          {
            layout: "blank",
          },
        ],
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "test.pptx")).toBe(true);
    });

    it("should create presentation with blank slide", async () => {
      const result = await tool.invoke({
        operation: "create",
        filePath: "test.pptx",
        slides: [
          {
            layout: "blank",
          },
        ],
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "test.pptx")).toBe(true);
    });
  });

  describe("create with elements", () => {
    it("should create slide with text element", async () => {
      const result = await tool.invoke({
        operation: "create",
        filePath: "test.pptx",
        slides: [
          {
            layout: "blank",
            elements: [
              {
                type: "text",
                text: "Hello World",
                x: 1,
                y: 1,
                w: 5,
                h: 1,
                fontSize: 24,
                bold: true,
              },
            ],
          },
        ],
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "test.pptx")).toBe(true);
    });

    it("should create slide with shape", async () => {
      const result = await tool.invoke({
        operation: "create",
        filePath: "test.pptx",
        slides: [
          {
            layout: "blank",
            elements: [
              {
                type: "shape",
                shapeType: "rect",
                x: 1,
                y: 1,
                w: 3,
                h: 2,
                fill: "0066CC",
              },
            ],
          },
        ],
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "test.pptx")).toBe(true);
    });

    it("should create slide with table", async () => {
      const result = await tool.invoke({
        operation: "create",
        filePath: "test.pptx",
        slides: [
          {
            layout: "blank",
            elements: [
              {
                type: "table",
                x: 1,
                y: 1,
                w: 8,
                h: 3,
                tableData: [
                  ["Name", "Age", "City"],
                  ["Alice", "30", "New York"],
                ],
              },
            ],
          },
        ],
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "test.pptx")).toBe(true);
    });

    it("should create slide with chart", async () => {
      const result = await tool.invoke({
        operation: "create",
        filePath: "test.pptx",
        slides: [
          {
            layout: "blank",
            elements: [
              {
                type: "chart",
                chartType: "bar",
                x: 1,
                y: 1,
                w: 8,
                h: 5,
                chartData: [
                  {
                    name: "Sales",
                    labels: ["Q1", "Q2", "Q3", "Q4"],
                    values: [100, 200, 150, 300],
                  },
                ],
              },
            ],
          },
        ],
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "test.pptx")).toBe(true);
    });
  });

  describe("create with theme", () => {
    it("should set presentation theme colors", async () => {
      const result = await tool.invoke({
        operation: "create",
        filePath: "test.pptx",
        theme: {
          primaryColor: "003366",
          secondaryColor: "0066CC",
        },
        slides: [{ layout: "title", title: "Themed Presentation" }],
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "test.pptx")).toBe(true);
    });
  });

  describe("add_slides", () => {
    it("should add slides to existing presentation", async () => {
      // First create
      await tool.invoke({
        operation: "create",
        filePath: "test.pptx",
        slides: [{ layout: "title", title: "Original" }],
      });

      // Then add slides
      const result = await tool.invoke({
        operation: "add_slides",
        filePath: "test.pptx",
        slides: [
          {
            layout: "titleAndContent",
            title: "New Slide",
            content: ["New content"],
          },
        ],
      });

      expect(result).not.toContain("Error:");
    });
  });

  describe("status events", () => {
    it("should emit tool_start and tool_end events", async () => {
      await tool.invoke({
        operation: "create",
        filePath: "test.pptx",
        slides: [{ layout: "title", title: "Test" }],
      });

      expect(events.some((e) => e.stage === "tool_start")).toBe(true);
      expect(events.some((e) => e.stage === "tool_end")).toBe(true);
    });
  });
});
