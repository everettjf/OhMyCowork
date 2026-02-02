import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestWorkspace,
  cleanupTestWorkspace,
  createMockEmitStatus,
  SAMPLE_HTML,
} from "./helpers.js";
import { createWebOperationsTool } from "../tools/web_operations.js";

describe("Web Operations Tool", () => {
  let workspaceRoot;
  let emitStatus;
  let events;
  let tool;

  beforeEach(async () => {
    workspaceRoot = await createTestWorkspace();
    const mock = createMockEmitStatus();
    emitStatus = mock.emitStatus;
    events = mock.events;
    tool = createWebOperationsTool({ workspaceRoot, emitStatus });
  });

  afterEach(async () => {
    await cleanupTestWorkspace(workspaceRoot);
  });

  describe("parse_html", () => {
    it("should parse HTML and extract elements by selector", async () => {
      const result = await tool.invoke({
        operation: "parse_html",
        html: SAMPLE_HTML,
        selector: "h1",
      });

      expect(result).not.toContain("Error:");
    });

    it("should extract multiple elements", async () => {
      const result = await tool.invoke({
        operation: "parse_html",
        html: SAMPLE_HTML,
        selector: "li",
      });

      expect(result).not.toContain("Error:");
    });

    it("should extract attributes", async () => {
      const result = await tool.invoke({
        operation: "parse_html",
        html: SAMPLE_HTML,
        selector: "a",
        attribute: "href",
      });

      expect(result).not.toContain("Error:");
    });
  });

  describe("extract_links", () => {
    it("should extract links from HTML", async () => {
      const result = await tool.invoke({
        operation: "extract_links",
        html: SAMPLE_HTML,
      });

      expect(result).not.toContain("Error:");
      expect(result).toContain("example.com");
    });
  });

  describe("extract_text", () => {
    it("should extract text content from HTML", async () => {
      const result = await tool.invoke({
        operation: "extract_text",
        html: SAMPLE_HTML,
      });

      expect(result).not.toContain("Error:");
    });
  });

  describe("http_request", () => {
    it("should require url for http_request", async () => {
      const result = await tool.invoke({
        operation: "http_request",
        method: "GET",
      });

      expect(result.toLowerCase()).toContain("error");
    });
  });

  describe("download_file", () => {
    it("should require url for download", async () => {
      const result = await tool.invoke({
        operation: "download_file",
      });

      expect(result.toLowerCase()).toContain("error");
    });
  });

  describe("status events", () => {
    it("should emit tool_start and tool_end events", async () => {
      await tool.invoke({
        operation: "parse_html",
        html: SAMPLE_HTML,
        selector: "h1",
      });

      expect(events.some((e) => e.stage === "tool_start")).toBe(true);
      expect(events.some((e) => e.stage === "tool_end")).toBe(true);
    });
  });
});
