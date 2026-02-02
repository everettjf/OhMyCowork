import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createTestWorkspace,
  cleanupTestWorkspace,
  createMockEmitStatus,
  fileExists,
} from "./helpers.js";
import { createImageOperationsTool } from "../tools/image_operations.js";

// Create a test image using sharp
async function createTestImage(workspaceRoot, filename, width = 100, height = 100) {
  const sharp = (await import("sharp")).default;
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();
  await writeFile(join(workspaceRoot, filename), buffer);
}

describe("Image Operations Tool", () => {
  let workspaceRoot;
  let emitStatus;
  let events;
  let tool;

  beforeEach(async () => {
    workspaceRoot = await createTestWorkspace();
    const mock = createMockEmitStatus();
    emitStatus = mock.emitStatus;
    events = mock.events;
    tool = createImageOperationsTool({ workspaceRoot, emitStatus });
  });

  afterEach(async () => {
    await cleanupTestWorkspace(workspaceRoot);
  });

  describe("get_info", () => {
    it("should get image information", async () => {
      await createTestImage(workspaceRoot, "test.png", 100, 100);

      const result = await tool.invoke({
        operation: "get_info",
        filePath: "test.png",
      });

      expect(result).not.toContain("Error:");
    });
  });

  describe("resize", () => {
    it("should resize an image", async () => {
      await createTestImage(workspaceRoot, "test.png", 100, 100);

      const result = await tool.invoke({
        operation: "resize",
        filePath: "test.png",
        outputPath: "resized.png",
        width: 50,
        height: 50,
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "resized.png")).toBe(true);
    });
  });

  describe("rotate", () => {
    it("should rotate an image", async () => {
      await createTestImage(workspaceRoot, "test.png", 100, 100);

      const result = await tool.invoke({
        operation: "rotate",
        filePath: "test.png",
        outputPath: "rotated.png",
        angle: 90,
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "rotated.png")).toBe(true);
    });
  });

  describe("flip", () => {
    it("should flip an image horizontally", async () => {
      await createTestImage(workspaceRoot, "test.png", 100, 100);

      const result = await tool.invoke({
        operation: "flip",
        filePath: "test.png",
        outputPath: "flipped.png",
        direction: "horizontal",
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "flipped.png")).toBe(true);
    });

    it("should flip an image vertically", async () => {
      await createTestImage(workspaceRoot, "test.png", 100, 100);

      const result = await tool.invoke({
        operation: "flip",
        filePath: "test.png",
        outputPath: "flipped.png",
        direction: "vertical",
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "flipped.png")).toBe(true);
    });
  });

  describe("convert", () => {
    it("should convert PNG to JPEG", async () => {
      await createTestImage(workspaceRoot, "test.png", 100, 100);

      const result = await tool.invoke({
        operation: "convert",
        filePath: "test.png",
        outputPath: "test.jpg",
        format: "jpeg",
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "test.jpg")).toBe(true);
    });
  });

  describe("grayscale", () => {
    it("should convert image to grayscale", async () => {
      await createTestImage(workspaceRoot, "test.png", 100, 100);

      const result = await tool.invoke({
        operation: "grayscale",
        filePath: "test.png",
        outputPath: "gray.png",
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "gray.png")).toBe(true);
    });
  });

  describe("blur", () => {
    it("should blur an image", async () => {
      await createTestImage(workspaceRoot, "test.png", 100, 100);

      const result = await tool.invoke({
        operation: "blur",
        filePath: "test.png",
        outputPath: "blurred.png",
        sigma: 5,
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "blurred.png")).toBe(true);
    });
  });

  describe("sharpen", () => {
    it("should sharpen an image", async () => {
      await createTestImage(workspaceRoot, "test.png", 100, 100);

      const result = await tool.invoke({
        operation: "sharpen",
        filePath: "test.png",
        outputPath: "sharpened.png",
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "sharpened.png")).toBe(true);
    });
  });

  describe("composite", () => {
    it("should composite two images", async () => {
      await createTestImage(workspaceRoot, "base.png", 100, 100);
      await createTestImage(workspaceRoot, "overlay.png", 50, 50);

      const result = await tool.invoke({
        operation: "composite",
        filePath: "base.png",
        outputPath: "composited.png",
        overlayPath: "overlay.png",
        left: 25,
        top: 25,
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "composited.png")).toBe(true);
    });
  });

  describe("thumbnail", () => {
    it("should create a thumbnail", async () => {
      await createTestImage(workspaceRoot, "test.png", 200, 200);

      const result = await tool.invoke({
        operation: "thumbnail",
        filePath: "test.png",
        outputPath: "thumb.png",
        width: 50,
        height: 50,
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "thumb.png")).toBe(true);
    });
  });

  describe("status events", () => {
    it("should emit tool_start and tool_end events", async () => {
      await createTestImage(workspaceRoot, "test.png", 100, 100);

      await tool.invoke({
        operation: "get_info",
        filePath: "test.png",
      });

      expect(events.some((e) => e.stage === "tool_start")).toBe(true);
      expect(events.some((e) => e.stage === "tool_end")).toBe(true);
    });
  });
});
