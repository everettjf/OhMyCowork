import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestWorkspace,
  cleanupTestWorkspace,
  createMockEmitStatus,
  createTestFiles,
  fileExists,
  readTestFile,
  SAMPLE_MARKDOWN,
  SAMPLE_JSON,
} from "./helpers.js";
import { createFormatConversionTool } from "../tools/format_conversion.js";

describe("Format Conversion Tool", () => {
  let workspaceRoot;
  let emitStatus;
  let events;
  let tool;

  beforeEach(async () => {
    workspaceRoot = await createTestWorkspace();
    const mock = createMockEmitStatus();
    emitStatus = mock.emitStatus;
    events = mock.events;
    tool = createFormatConversionTool({ workspaceRoot, emitStatus });
  });

  afterEach(async () => {
    await cleanupTestWorkspace(workspaceRoot);
  });

  describe("markdown_to_html", () => {
    it("should convert markdown to HTML", async () => {
      await createTestFiles(workspaceRoot, {
        "doc.md": SAMPLE_MARKDOWN,
      });

      const result = await tool.invoke({
        operation: "markdown_to_html",
        inputPath: "doc.md",
        outputPath: "doc.html",
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "doc.html")).toBe(true);
    });
  });

  describe("json_to_csv", () => {
    it("should convert JSON array to CSV", async () => {
      await createTestFiles(workspaceRoot, {
        "data.json": SAMPLE_JSON,
      });

      const result = await tool.invoke({
        operation: "json_to_csv",
        inputPath: "data.json",
        outputPath: "data.csv",
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "data.csv")).toBe(true);
    });
  });

  describe("csv_to_json", () => {
    it("should convert CSV to JSON", async () => {
      await createTestFiles(workspaceRoot, {
        "data.csv": `name,age,city
Alice,30,New York
Bob,25,Los Angeles`,
      });

      const result = await tool.invoke({
        operation: "csv_to_json",
        inputPath: "data.csv",
        outputPath: "data.json",
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "data.json")).toBe(true);
    });
  });

  describe("yaml_to_json", () => {
    it("should convert YAML to JSON", async () => {
      await createTestFiles(workspaceRoot, {
        "config.yaml": `name: Test
version: 1.0
features:
  - feature1
  - feature2`,
      });

      const result = await tool.invoke({
        operation: "yaml_to_json",
        inputPath: "config.yaml",
        outputPath: "config.json",
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "config.json")).toBe(true);
    });
  });

  describe("json_to_yaml", () => {
    it("should convert JSON to YAML", async () => {
      await createTestFiles(workspaceRoot, {
        "config.json": JSON.stringify({
          name: "Test",
          version: "1.0",
          features: ["feature1", "feature2"],
        }),
      });

      const result = await tool.invoke({
        operation: "json_to_yaml",
        inputPath: "config.json",
        outputPath: "config.yaml",
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "config.yaml")).toBe(true);
    });
  });

  describe("text_to_base64", () => {
    it("should encode text to base64", async () => {
      await createTestFiles(workspaceRoot, {
        "text.txt": "Hello, World!",
      });

      const result = await tool.invoke({
        operation: "text_to_base64",
        inputPath: "text.txt",
        outputPath: "encoded.txt",
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "encoded.txt")).toBe(true);
    });
  });

  describe("base64_to_text", () => {
    it("should decode base64 to text", async () => {
      await createTestFiles(workspaceRoot, {
        "encoded.txt": "SGVsbG8sIFdvcmxkIQ==",
      });

      const result = await tool.invoke({
        operation: "base64_to_text",
        inputPath: "encoded.txt",
        outputPath: "decoded.txt",
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "decoded.txt")).toBe(true);
    });
  });

  describe("html_to_markdown", () => {
    it("should convert HTML to Markdown", async () => {
      await createTestFiles(workspaceRoot, {
        "page.html": `<h1>Title</h1><p>Paragraph text.</p>`,
      });

      const result = await tool.invoke({
        operation: "html_to_markdown",
        inputPath: "page.html",
        outputPath: "page.md",
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "page.md")).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should return error for non-existent input file", async () => {
      const result = await tool.invoke({
        operation: "json_to_csv",
        inputPath: "nonexistent.json",
        outputPath: "output.csv",
      });

      expect(result.toLowerCase()).toContain("error");
    });
  });

  describe("status events", () => {
    it("should emit tool_start and tool_end events", async () => {
      await createTestFiles(workspaceRoot, {
        "doc.md": SAMPLE_MARKDOWN,
      });

      await tool.invoke({
        operation: "markdown_to_html",
        inputPath: "doc.md",
        outputPath: "doc.html",
      });

      expect(events.some((e) => e.stage === "tool_start")).toBe(true);
      expect(events.some((e) => e.stage === "tool_end")).toBe(true);
    });
  });
});
