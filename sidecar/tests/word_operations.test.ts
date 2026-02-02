import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestWorkspace,
  cleanupTestWorkspace,
  createMockEmitStatus,
  createTestFiles,
  fileExists,
  SAMPLE_MARKDOWN,
} from "./helpers.js";
import { createWordOperationsTool } from "../tools/word_operations.js";

describe("Word Operations Tool", () => {
  let workspaceRoot;
  let emitStatus;
  let events;
  let tool;

  beforeEach(async () => {
    workspaceRoot = await createTestWorkspace();
    const mock = createMockEmitStatus();
    emitStatus = mock.emitStatus;
    events = mock.events;
    tool = createWordOperationsTool({ workspaceRoot, emitStatus });
  });

  afterEach(async () => {
    await cleanupTestWorkspace(workspaceRoot);
  });

  describe("create", () => {
    it("should create a new Word document", async () => {
      const result = await tool.invoke({
        operation: "create",
        filePath: "test.docx",
        content: [
          { type: "heading1", text: "Test Document" },
          { type: "paragraph", text: "This is a test paragraph." },
        ],
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "test.docx")).toBe(true);
    });

    it("should create document with multiple content types", async () => {
      const result = await tool.invoke({
        operation: "create",
        filePath: "test.docx",
        content: [
          { type: "heading1", text: "Main Title" },
          { type: "paragraph", text: "Introduction paragraph." },
          { type: "heading2", text: "Section 1" },
          { type: "bullet", items: ["Item 1", "Item 2", "Item 3"] },
          { type: "heading2", text: "Section 2" },
          { type: "numbered", items: ["First", "Second", "Third"] },
        ],
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "test.docx")).toBe(true);
    });

    it("should create document with table", async () => {
      const result = await tool.invoke({
        operation: "create",
        filePath: "test.docx",
        content: [
          { type: "heading1", text: "Data Table" },
          {
            type: "table",
            rows: [
              ["Name", "Age", "City"],
              ["Alice", "30", "New York"],
              ["Bob", "25", "Los Angeles"],
            ],
          },
        ],
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "test.docx")).toBe(true);
    });
  });

  describe("read", () => {
    it("should read a Word document", async () => {
      // First create
      await tool.invoke({
        operation: "create",
        filePath: "test.docx",
        content: [
          { type: "heading1", text: "Test" },
          { type: "paragraph", text: "Content here." },
        ],
      });

      // Then read
      const result = await tool.invoke({
        operation: "read",
        filePath: "test.docx",
      });

      expect(result).not.toContain("Error:");
      expect(result.toLowerCase()).toContain("test");
    });

    it("should return error for non-existent file", async () => {
      const result = await tool.invoke({
        operation: "read",
        filePath: "nonexistent.docx",
      });

      expect(result.toLowerCase()).toContain("error");
    });
  });

  describe("to_html", () => {
    it("should convert Word to HTML", async () => {
      await tool.invoke({
        operation: "create",
        filePath: "test.docx",
        content: [
          { type: "heading1", text: "Title" },
          { type: "paragraph", text: "Paragraph text." },
        ],
      });

      const result = await tool.invoke({
        operation: "to_html",
        filePath: "test.docx",
      });

      expect(result).not.toContain("Error:");
    });
  });

  describe("from_markdown", () => {
    it("should create Word document from Markdown", async () => {
      const result = await tool.invoke({
        operation: "from_markdown",
        filePath: "output.docx",
        markdown: SAMPLE_MARKDOWN,
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "output.docx")).toBe(true);
    });
  });

  describe("add_header_footer", () => {
    it("should add header and footer to document", async () => {
      await tool.invoke({
        operation: "create",
        filePath: "test.docx",
        content: [{ type: "paragraph", text: "Body content" }],
      });

      const result = await tool.invoke({
        operation: "add_header_footer",
        filePath: "test.docx",
        headerText: "Document Header",
        footerText: "Page Footer",
      });

      expect(result).not.toContain("Error:");
    });
  });

  describe("status events", () => {
    it("should emit tool_start and tool_end events", async () => {
      await tool.invoke({
        operation: "create",
        filePath: "test.docx",
        content: [{ type: "paragraph", text: "Test" }],
      });

      expect(events.some((e) => e.stage === "tool_start")).toBe(true);
      expect(events.some((e) => e.stage === "tool_end")).toBe(true);
    });
  });
});
