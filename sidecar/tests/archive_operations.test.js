import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestWorkspace,
  cleanupTestWorkspace,
  createMockEmitStatus,
  createTestFiles,
  fileExists,
  readTestFile,
} from "./helpers.js";
import { createArchiveOperationsTool } from "../tools/archive_operations.js";

describe("Archive Operations Tool", () => {
  let workspaceRoot;
  let emitStatus;
  let events;
  let tool;

  beforeEach(async () => {
    workspaceRoot = await createTestWorkspace();
    const mock = createMockEmitStatus();
    emitStatus = mock.emitStatus;
    events = mock.events;
    tool = createArchiveOperationsTool({ workspaceRoot, emitStatus });
  });

  afterEach(async () => {
    await cleanupTestWorkspace(workspaceRoot);
  });

  describe("zip", () => {
    it("should create a zip file from files", async () => {
      await createTestFiles(workspaceRoot, {
        "file1.txt": "content1",
        "file2.txt": "content2",
      });

      const result = await tool.invoke({
        operation: "zip",
        filePath: "archive.zip",
        sourcePaths: ["file1.txt", "file2.txt"],
      });
      const parsed = JSON.parse(result);

      expect(parsed.operation).toBe("zip");
      expect(parsed.output).toBe("archive.zip");
      expect(await fileExists(workspaceRoot, "archive.zip")).toBe(true);
    });

    it("should create a zip file from a directory", async () => {
      await createTestFiles(workspaceRoot, {
        "mydir/file1.txt": "content1",
        "mydir/file2.txt": "content2",
        "mydir/subdir/file3.txt": "content3",
      });

      const result = await tool.invoke({
        operation: "zip",
        filePath: "mydir.zip",
        sourcePaths: ["mydir"],
      });
      const parsed = JSON.parse(result);

      expect(parsed.operation).toBe("zip");
      expect(await fileExists(workspaceRoot, "mydir.zip")).toBe(true);
    });

    it("should require sourcePaths for zip", async () => {
      const result = await tool.invoke({
        operation: "zip",
        filePath: "archive.zip",
      });

      expect(result).toContain("Error");
      expect(result).toContain("sourcePaths");
    });
  });

  describe("unzip", () => {
    it("should extract a zip file", async () => {
      // First create a zip
      await createTestFiles(workspaceRoot, {
        "source/file1.txt": "content1",
        "source/file2.txt": "content2",
      });

      await tool.invoke({
        operation: "zip",
        filePath: "test.zip",
        sourcePaths: ["source"],
      });

      // Then extract it
      const result = await tool.invoke({
        operation: "unzip",
        filePath: "test.zip",
        extractTo: "extracted",
      });
      const parsed = JSON.parse(result);

      expect(parsed.operation).toBe("unzip");
      expect(await fileExists(workspaceRoot, "extracted")).toBe(true);
    });

    it("should return error for non-existent file", async () => {
      const result = await tool.invoke({
        operation: "unzip",
        filePath: "nonexistent.zip",
      });

      expect(result).toContain("Error");
      expect(result).toContain("not found");
    });
  });

  describe("tar", () => {
    it("should create a tar file", async () => {
      await createTestFiles(workspaceRoot, {
        "file1.txt": "content1",
        "file2.txt": "content2",
      });

      const result = await tool.invoke({
        operation: "tar",
        filePath: "archive.tar",
        sourcePaths: ["file1.txt", "file2.txt"],
      });
      const parsed = JSON.parse(result);

      expect(parsed.operation).toBe("tar");
      expect(parsed.compressed).toBe(false);
      expect(await fileExists(workspaceRoot, "archive.tar")).toBe(true);
    });

    it("should create a tar.gz file", async () => {
      await createTestFiles(workspaceRoot, {
        "file1.txt": "content1",
        "file2.txt": "content2",
      });

      const result = await tool.invoke({
        operation: "tar",
        filePath: "archive.tar.gz",
        sourcePaths: ["file1.txt", "file2.txt"],
        tarGzip: true,
      });
      const parsed = JSON.parse(result);

      expect(parsed.operation).toBe("tar");
      expect(parsed.compressed).toBe(true);
      expect(await fileExists(workspaceRoot, "archive.tar.gz")).toBe(true);
    });
  });

  describe("untar", () => {
    it("should extract a tar file", async () => {
      await createTestFiles(workspaceRoot, {
        "file1.txt": "content1",
        "file2.txt": "content2",
      });

      await tool.invoke({
        operation: "tar",
        filePath: "test.tar",
        sourcePaths: ["file1.txt", "file2.txt"],
      });

      const result = await tool.invoke({
        operation: "untar",
        filePath: "test.tar",
        extractTo: "extracted",
      });
      const parsed = JSON.parse(result);

      expect(parsed.operation).toBe("untar");
      expect(await fileExists(workspaceRoot, "extracted/file1.txt")).toBe(true);
      expect(await fileExists(workspaceRoot, "extracted/file2.txt")).toBe(true);
    });
  });

  describe("gzip", () => {
    it("should compress a file with gzip", async () => {
      await createTestFiles(workspaceRoot, {
        "file.txt": "hello world ".repeat(100),
      });

      const result = await tool.invoke({
        operation: "gzip",
        filePath: "file.txt",
      });
      const parsed = JSON.parse(result);

      expect(parsed.operation).toBe("gzip");
      expect(parsed.compressedSize).toBeLessThan(parsed.originalSize);
      expect(await fileExists(workspaceRoot, "file.txt.gz")).toBe(true);
    });
  });

  describe("gunzip", () => {
    it("should decompress a gzip file", async () => {
      await createTestFiles(workspaceRoot, {
        "file.txt": "hello world ".repeat(100),
      });

      // First compress
      await tool.invoke({
        operation: "gzip",
        filePath: "file.txt",
      });

      // Then decompress
      const result = await tool.invoke({
        operation: "gunzip",
        filePath: "file.txt.gz",
        extractTo: "decompressed.txt",
      });
      const parsed = JSON.parse(result);

      expect(parsed.operation).toBe("gunzip");
      expect(await fileExists(workspaceRoot, "decompressed.txt")).toBe(true);

      const content = await readTestFile(workspaceRoot, "decompressed.txt");
      expect(content).toBe("hello world ".repeat(100));
    });
  });

  describe("list", () => {
    it("should list contents of a zip file", async () => {
      await createTestFiles(workspaceRoot, {
        "file1.txt": "content1",
        "file2.txt": "content2",
        "subdir/file3.txt": "content3",
      });

      await tool.invoke({
        operation: "zip",
        filePath: "test.zip",
        sourcePaths: ["file1.txt", "file2.txt", "subdir"],
      });

      const result = await tool.invoke({
        operation: "list",
        filePath: "test.zip",
      });
      const parsed = JSON.parse(result);

      expect(parsed.operation).toBe("list");
      expect(parsed.fileCount).toBeGreaterThanOrEqual(3);
    });

    it("should list contents of a tar file", async () => {
      await createTestFiles(workspaceRoot, {
        "file1.txt": "content1",
        "file2.txt": "content2",
      });

      await tool.invoke({
        operation: "tar",
        filePath: "test.tar",
        sourcePaths: ["file1.txt", "file2.txt"],
      });

      const result = await tool.invoke({
        operation: "list",
        filePath: "test.tar",
      });
      const parsed = JSON.parse(result);

      expect(parsed.operation).toBe("list");
      expect(parsed.fileCount).toBe(2);
    });
  });

  describe("status events", () => {
    it("should emit tool_start and tool_end events", async () => {
      await createTestFiles(workspaceRoot, {
        "file.txt": "content",
      });

      await tool.invoke({
        operation: "zip",
        filePath: "test.zip",
        sourcePaths: ["file.txt"],
      });

      expect(events.some((e) => e.stage === "tool_start")).toBe(true);
      expect(events.some((e) => e.stage === "tool_end")).toBe(true);
    });

    it("should emit tool_error on failure", async () => {
      await tool.invoke({
        operation: "unzip",
        filePath: "nonexistent.zip",
      });

      expect(events.some((e) => e.stage === "tool_error")).toBe(true);
    });
  });
});
