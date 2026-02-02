import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestWorkspace,
  cleanupTestWorkspace,
  createMockEmitStatus,
  createTestFiles,
  fileExists,
  SAMPLE_CSV,
} from "./helpers.js";
import { createExcelOperationsTool } from "../tools/excel_operations.js";

describe("Excel Operations Tool", () => {
  let workspaceRoot;
  let emitStatus;
  let events;
  let tool;

  beforeEach(async () => {
    workspaceRoot = await createTestWorkspace();
    const mock = createMockEmitStatus();
    emitStatus = mock.emitStatus;
    events = mock.events;
    tool = createExcelOperationsTool({ workspaceRoot, emitStatus });
  });

  afterEach(async () => {
    await cleanupTestWorkspace(workspaceRoot);
  });

  describe("create", () => {
    it("should create a new Excel file", async () => {
      const result = await tool.invoke({
        operation: "create",
        filePath: "test.xlsx",
        sheetName: "Data",
        data: [
          ["Name", "Age", "City"],
          ["Alice", 30, "New York"],
          ["Bob", 25, "Los Angeles"],
        ],
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "test.xlsx")).toBe(true);
    });

    it("should create Excel with headers", async () => {
      const result = await tool.invoke({
        operation: "create",
        filePath: "test.xlsx",
        sheetName: "Data",
        headers: ["Name", "Age", "City"],
        data: [
          ["Alice", 30, "New York"],
          ["Bob", 25, "Los Angeles"],
        ],
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "test.xlsx")).toBe(true);
    });
  });

  describe("read", () => {
    it("should read an Excel file", async () => {
      // First create
      await tool.invoke({
        operation: "create",
        filePath: "test.xlsx",
        sheetName: "Data",
        data: [
          ["Name", "Age"],
          ["Alice", 30],
          ["Bob", 25],
        ],
      });

      // Then read
      const result = await tool.invoke({
        operation: "read",
        filePath: "test.xlsx",
      });

      expect(result).not.toContain("Error:");
    });

    it("should return error for non-existent file", async () => {
      const result = await tool.invoke({
        operation: "read",
        filePath: "nonexistent.xlsx",
      });

      expect(result.toLowerCase()).toContain("error");
    });
  });

  describe("analyze", () => {
    it("should analyze an Excel file", async () => {
      await tool.invoke({
        operation: "create",
        filePath: "test.xlsx",
        sheetName: "Data",
        headers: ["Name", "Value"],
        data: [
          ["A", 10],
          ["B", 20],
          ["C", 30],
        ],
      });

      const result = await tool.invoke({
        operation: "analyze",
        filePath: "test.xlsx",
      });

      expect(result).not.toContain("Error:");
    });
  });

  describe("add_sheet", () => {
    it("should add a new sheet to Excel file", async () => {
      await tool.invoke({
        operation: "create",
        filePath: "test.xlsx",
        sheetName: "Sheet1",
        data: [["A", "B"]],
      });

      const result = await tool.invoke({
        operation: "add_sheet",
        filePath: "test.xlsx",
        sheetName: "Sheet2",
        data: [["C", "D"]],
      });

      expect(result).not.toContain("Error:");
    });
  });

  describe("csv_to_excel", () => {
    it("should convert CSV to Excel", async () => {
      await createTestFiles(workspaceRoot, {
        "data.csv": SAMPLE_CSV,
      });

      const result = await tool.invoke({
        operation: "csv_to_excel",
        filePath: "data.xlsx",
        csvPath: "data.csv",
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "data.xlsx")).toBe(true);
    });
  });

  describe("excel_to_csv", () => {
    it("should convert Excel to CSV", async () => {
      await tool.invoke({
        operation: "create",
        filePath: "test.xlsx",
        sheetName: "Data",
        data: [
          ["Name", "Age"],
          ["Alice", 30],
          ["Bob", 25],
        ],
      });

      const result = await tool.invoke({
        operation: "excel_to_csv",
        filePath: "test.xlsx",
        csvPath: "output.csv",
      });

      expect(result).not.toContain("Error:");
      expect(await fileExists(workspaceRoot, "output.csv")).toBe(true);
    });
  });

  describe("status events", () => {
    it("should emit tool_start and tool_end events", async () => {
      await tool.invoke({
        operation: "create",
        filePath: "test.xlsx",
        sheetName: "Data",
        data: [["A"]],
      });

      expect(events.some((e) => e.stage === "tool_start")).toBe(true);
      expect(events.some((e) => e.stage === "tool_end")).toBe(true);
    });
  });
});
