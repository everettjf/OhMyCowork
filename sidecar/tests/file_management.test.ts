import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestWorkspace,
  cleanupTestWorkspace,
  createMockEmitStatus,
  createTestFiles,
  fileExists,
  readTestFile,
} from "./helpers.js";
import {
  createFileSearchTool,
  createFileRenameTool,
  createFindDuplicatesTool,
  createFolderStructureTool,
  createFileCopyMoveTool,
  createFileDeleteTool,
} from "../tools/file_management.js";

describe("File Management Tools", () => {
  let workspaceRoot;
  let emitStatus;
  let events;

  beforeEach(async () => {
    workspaceRoot = await createTestWorkspace();
    const mock = createMockEmitStatus();
    emitStatus = mock.emitStatus;
    events = mock.events;
  });

  afterEach(async () => {
    await cleanupTestWorkspace(workspaceRoot);
  });

  describe("file_search", () => {
    it("should search files by name pattern", async () => {
      await createTestFiles(workspaceRoot, {
        "test1.txt": "content1",
        "test2.txt": "content2",
        "other.md": "markdown",
        "subdir/test3.txt": "content3",
      });

      const tool = createFileSearchTool({ workspaceRoot, emitStatus });
      const result = await tool.invoke({ pattern: "**/*.txt" });
      const parsed = JSON.parse(result);

      expect(parsed.total).toBe(3);
      expect(parsed.files.some((f) => f.path.includes("test1.txt"))).toBe(true);
      expect(parsed.files.some((f) => f.path.includes("test2.txt"))).toBe(true);
    });

    it("should filter by maxResults", async () => {
      await createTestFiles(workspaceRoot, {
        "file1.txt": "a",
        "file2.txt": "b",
        "file3.txt": "c",
        "file4.txt": "d",
      });

      const tool = createFileSearchTool({ workspaceRoot, emitStatus });
      const result = await tool.invoke({
        pattern: "**/*.txt",
        maxResults: 2,
      });
      const parsed = JSON.parse(result);

      expect(parsed.files.length).toBe(2);
    });

    it("should search in a specific path", async () => {
      await createTestFiles(workspaceRoot, {
        "root.txt": "root",
        "subdir/sub.txt": "sub",
      });

      const tool = createFileSearchTool({ workspaceRoot, emitStatus });
      const result = await tool.invoke({
        pattern: "**/*.txt",
        path: "subdir",
      });
      const parsed = JSON.parse(result);

      expect(parsed.total).toBe(1);
      expect(parsed.files[0].path).toBe("sub.txt");
    });
  });

  describe("file_rename", () => {
    it("should rename files with pattern replacement", async () => {
      await createTestFiles(workspaceRoot, {
        "photo_001.jpg": "img1",
        "photo_002.jpg": "img2",
        "photo_003.jpg": "img3",
      });

      const tool = createFileRenameTool({ workspaceRoot, emitStatus });
      const result = await tool.invoke({
        files: ["photo_001.jpg", "photo_002.jpg", "photo_003.jpg"],
        pattern: "photo_",
        replacement: "image_",
      });
      const parsed = JSON.parse(result);

      expect(parsed.results.filter((r) => r.success).length).toBe(3);
      expect(await fileExists(workspaceRoot, "image_001.jpg")).toBe(true);
    });

    it("should add prefix and suffix", async () => {
      await createTestFiles(workspaceRoot, {
        "doc.txt": "content",
      });

      const tool = createFileRenameTool({ workspaceRoot, emitStatus });
      const result = await tool.invoke({
        files: ["doc.txt"],
        prefix: "2024_",
        suffix: "_final",
      });
      const parsed = JSON.parse(result);

      expect(parsed.results[0].success).toBe(true);
      expect(await fileExists(workspaceRoot, "2024_doc_final.txt")).toBe(true);
    });

    it("should support dry run", async () => {
      await createTestFiles(workspaceRoot, {
        "old.txt": "content",
      });

      const tool = createFileRenameTool({ workspaceRoot, emitStatus });
      const result = await tool.invoke({
        files: ["old.txt"],
        prefix: "new_",
        dryRun: true,
      });
      const parsed = JSON.parse(result);

      expect(parsed.dryRun).toBe(true);
      expect(parsed.results[0].wouldRenameTo).toBeDefined();
      expect(await fileExists(workspaceRoot, "old.txt")).toBe(true);
    });
  });

  describe("find_duplicates", () => {
    it("should find duplicate files by hash", async () => {
      await createTestFiles(workspaceRoot, {
        "file1.txt": "same content",
        "file2.txt": "same content",
        "file3.txt": "different content",
      });

      const tool = createFindDuplicatesTool({ workspaceRoot, emitStatus });
      const result = await tool.invoke({});
      const parsed = JSON.parse(result);

      expect(parsed.duplicateGroups.length).toBe(1);
      expect(parsed.duplicateGroups[0].files.length).toBe(2);
    });

    it("should filter by minimum size", async () => {
      await createTestFiles(workspaceRoot, {
        "small1.txt": "a",
        "small2.txt": "a",
        "large1.txt": "x".repeat(100),
        "large2.txt": "x".repeat(100),
      });

      const tool = createFindDuplicatesTool({ workspaceRoot, emitStatus });
      const result = await tool.invoke({ minSize: 50 });
      const parsed = JSON.parse(result);

      expect(parsed.duplicateGroups.length).toBe(1);
      expect(parsed.duplicateGroups[0].files.some((f) => f.includes("large"))).toBe(true);
    });
  });

  describe("folder_structure", () => {
    it("should create a single folder", async () => {
      const tool = createFolderStructureTool({ workspaceRoot, emitStatus });
      const result = await tool.invoke({ structure: ["new_folder"] });
      const parsed = JSON.parse(result);

      expect(parsed.created.length).toBe(1);
      expect(await fileExists(workspaceRoot, "new_folder")).toBe(true);
    });

    it("should create nested folders", async () => {
      const tool = createFolderStructureTool({ workspaceRoot, emitStatus });
      const result = await tool.invoke({
        structure: [
          {
            name: "parent",
            children: [
              { name: "child1" },
              { name: "child2", children: [{ name: "grandchild" }] },
            ],
          },
        ],
      });
      const parsed = JSON.parse(result);

      expect(parsed.created.length).toBeGreaterThanOrEqual(1);
      expect(await fileExists(workspaceRoot, "parent")).toBe(true);
      expect(await fileExists(workspaceRoot, "parent/child1")).toBe(true);
      expect(await fileExists(workspaceRoot, "parent/child2/grandchild")).toBe(true);
    });

    it("should create multiple folders", async () => {
      const tool = createFolderStructureTool({ workspaceRoot, emitStatus });
      const result = await tool.invoke({
        structure: ["folder1", "folder2", "folder3"],
      });
      const parsed = JSON.parse(result);

      expect(parsed.created.length).toBe(3);
      expect(await fileExists(workspaceRoot, "folder1")).toBe(true);
      expect(await fileExists(workspaceRoot, "folder2")).toBe(true);
      expect(await fileExists(workspaceRoot, "folder3")).toBe(true);
    });
  });

  describe("file_copy_move", () => {
    it("should copy a file", async () => {
      await createTestFiles(workspaceRoot, {
        "source.txt": "content",
      });

      const tool = createFileCopyMoveTool({ workspaceRoot, emitStatus });
      const result = await tool.invoke({
        operation: "copy",
        source: "source.txt",
        destination: "dest.txt",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(await fileExists(workspaceRoot, "source.txt")).toBe(true);
      expect(await fileExists(workspaceRoot, "dest.txt")).toBe(true);
    });

    it("should move a file", async () => {
      await createTestFiles(workspaceRoot, {
        "source.txt": "content",
      });

      const tool = createFileCopyMoveTool({ workspaceRoot, emitStatus });
      const result = await tool.invoke({
        operation: "move",
        source: "source.txt",
        destination: "moved.txt",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(await fileExists(workspaceRoot, "source.txt")).toBe(false);
      expect(await fileExists(workspaceRoot, "moved.txt")).toBe(true);
    });

    it("should copy to subdirectory", async () => {
      await createTestFiles(workspaceRoot, {
        "file.txt": "content",
      });

      const tool = createFileCopyMoveTool({ workspaceRoot, emitStatus });
      const result = await tool.invoke({
        operation: "copy",
        source: "file.txt",
        destination: "subdir/file.txt",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(await fileExists(workspaceRoot, "subdir/file.txt")).toBe(true);
    });
  });

  describe("file_delete", () => {
    it("should delete a file", async () => {
      await createTestFiles(workspaceRoot, {
        "to_delete.txt": "content",
      });

      const tool = createFileDeleteTool({ workspaceRoot, emitStatus });
      const result = await tool.invoke({ paths: ["to_delete.txt"], confirmDelete: true });
      const parsed = JSON.parse(result);

      expect(parsed.results[0].deleted).toBe(true);
      expect(await fileExists(workspaceRoot, "to_delete.txt")).toBe(false);
    });

    it("should delete multiple files", async () => {
      await createTestFiles(workspaceRoot, {
        "file1.txt": "content1",
        "file2.txt": "content2",
        "file3.txt": "content3",
      });

      const tool = createFileDeleteTool({ workspaceRoot, emitStatus });
      const result = await tool.invoke({
        paths: ["file1.txt", "file2.txt"],
        confirmDelete: true,
      });
      const parsed = JSON.parse(result);

      expect(parsed.results.filter((r) => r.deleted).length).toBe(2);
      expect(await fileExists(workspaceRoot, "file1.txt")).toBe(false);
      expect(await fileExists(workspaceRoot, "file2.txt")).toBe(false);
      expect(await fileExists(workspaceRoot, "file3.txt")).toBe(true);
    });

    it("should delete by pattern", async () => {
      await createTestFiles(workspaceRoot, {
        "test1.log": "log1",
        "test2.log": "log2",
        "keep.txt": "keep",
      });

      const tool = createFileDeleteTool({ workspaceRoot, emitStatus });
      const result = await tool.invoke({ pattern: "**/*.log", confirmDelete: true });
      const parsed = JSON.parse(result);

      expect(parsed.results.filter((r) => r.deleted).length).toBe(2);
      expect(await fileExists(workspaceRoot, "keep.txt")).toBe(true);
    });

    it("should support dry run", async () => {
      await createTestFiles(workspaceRoot, {
        "file.txt": "content",
      });

      const tool = createFileDeleteTool({ workspaceRoot, emitStatus });
      const result = await tool.invoke({
        paths: ["file.txt"],
        dryRun: true,
      });
      const parsed = JSON.parse(result);

      expect(parsed.dryRun).toBe(true);
      expect(parsed.results[0].wouldDelete).toBe(true);
      expect(await fileExists(workspaceRoot, "file.txt")).toBe(true);
    });
  });
});
