import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestWorkspace,
  cleanupTestWorkspace,
  createMockEmitStatus,
  fileExists,
} from "./helpers.js";
import { createPDFOperationsTool } from "../tools/pdf_operations.js";

describe("PDF Operations Tool", () => {
  let workspaceRoot;
  let emitStatus;
  let events;
  let tool;

  beforeEach(async () => {
    workspaceRoot = await createTestWorkspace();
    const mock = createMockEmitStatus();
    emitStatus = mock.emitStatus;
    events = mock.events;
    tool = createPDFOperationsTool({ workspaceRoot, emitStatus });
  });

  afterEach(async () => {
    await cleanupTestWorkspace(workspaceRoot);
  });

  describe("create", () => {
    it("should create a new PDF document", async () => {
      const result = await tool.invoke({
        operation: "create",
        filePath: "test.pdf",
        content: [
          { type: "heading", text: "Test Document" },
          { type: "paragraph", text: "This is a test paragraph." },
        ],
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "test.pdf")).toBe(true);
    });

    it("should create PDF with page breaks", async () => {
      const result = await tool.invoke({
        operation: "create",
        filePath: "test.pdf",
        content: [
          { type: "paragraph", text: "Page 1 content" },
          { type: "pageBreak" },
          { type: "paragraph", text: "Page 2 content" },
        ],
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "test.pdf")).toBe(true);
    });
  });

  describe("merge", () => {
    it("should merge multiple PDF files", async () => {
      // Create two PDFs first
      await tool.invoke({
        operation: "create",
        filePath: "doc1.pdf",
        content: [{ type: "paragraph", text: "Document 1" }],
      });
      await tool.invoke({
        operation: "create",
        filePath: "doc2.pdf",
        content: [{ type: "paragraph", text: "Document 2" }],
      });

      // Merge them
      const result = await tool.invoke({
        operation: "merge",
        filePath: "merged.pdf",
        mergeFiles: ["doc1.pdf", "doc2.pdf"],
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "merged.pdf")).toBe(true);
    });
  });

  describe("get_info", () => {
    it("should get PDF information", async () => {
      await tool.invoke({
        operation: "create",
        filePath: "test.pdf",
        content: [{ type: "paragraph", text: "Test content" }],
      });

      const result = await tool.invoke({
        operation: "get_info",
        filePath: "test.pdf",
      });

      expect(result).not.toContain("Error:");
    });

    it("should return error for non-existent file", async () => {
      const result = await tool.invoke({
        operation: "get_info",
        filePath: "nonexistent.pdf",
      });

      expect(result.toLowerCase()).toContain("error");
    });
  });

  describe("add_watermark", () => {
    it("should add text watermark to PDF", async () => {
      await tool.invoke({
        operation: "create",
        filePath: "test.pdf",
        content: [{ type: "paragraph", text: "Document content" }],
      });

      const result = await tool.invoke({
        operation: "add_watermark",
        filePath: "test.pdf",
        outputPath: "watermarked.pdf",
        watermarkText: "CONFIDENTIAL",
        watermarkOpacity: 0.3,
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "watermarked.pdf")).toBe(true);
    });
  });

  describe("rotate_pages", () => {
    it("should rotate pages in PDF", async () => {
      await tool.invoke({
        operation: "create",
        filePath: "test.pdf",
        content: [{ type: "paragraph", text: "Rotate me" }],
      });

      const result = await tool.invoke({
        operation: "rotate_pages",
        filePath: "test.pdf",
        outputPath: "rotated.pdf",
        rotationDegrees: 90,
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "rotated.pdf")).toBe(true);
    });
  });

  describe("status events", () => {
    it("should emit tool_start and tool_end events", async () => {
      await tool.invoke({
        operation: "create",
        filePath: "test.pdf",
        content: [{ type: "paragraph", text: "Test" }],
      });

      expect(events.some((e) => e.stage === "tool_start")).toBe(true);
      expect(events.some((e) => e.stage === "tool_end")).toBe(true);
    });
  });
});
