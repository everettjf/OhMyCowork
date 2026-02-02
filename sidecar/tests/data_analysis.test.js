import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestWorkspace,
  cleanupTestWorkspace,
  createMockEmitStatus,
  createTestFiles,
  SAMPLE_CSV,
} from "./helpers.js";
import { createDataAnalysisTool } from "../tools/data_analysis.js";

describe("Data Analysis Tool", () => {
  let workspaceRoot;
  let emitStatus;
  let events;
  let tool;

  beforeEach(async () => {
    workspaceRoot = await createTestWorkspace();
    const mock = createMockEmitStatus();
    emitStatus = mock.emitStatus;
    events = mock.events;
    tool = createDataAnalysisTool({ workspaceRoot, emitStatus });
  });

  afterEach(async () => {
    await cleanupTestWorkspace(workspaceRoot);
  });

  describe("read_csv", () => {
    it("should read a CSV file", async () => {
      await createTestFiles(workspaceRoot, {
        "data.csv": SAMPLE_CSV,
      });

      const result = await tool.invoke({
        operation: "read_csv",
        filePath: "data.csv",
      });

      expect(result).not.toContain("Error:");
    });

    it("should return error for non-existent file", async () => {
      const result = await tool.invoke({
        operation: "read_csv",
        filePath: "nonexistent.csv",
      });

      expect(result.toLowerCase()).toContain("error");
    });
  });

  describe("describe", () => {
    it("should describe dataset statistics", async () => {
      await createTestFiles(workspaceRoot, {
        "data.csv": SAMPLE_CSV,
      });

      const result = await tool.invoke({
        operation: "describe",
        filePath: "data.csv",
      });

      expect(result).not.toContain("Error:");
    });
  });

  describe("statistics", () => {
    it("should calculate statistics for a column", async () => {
      await createTestFiles(workspaceRoot, {
        "data.csv": SAMPLE_CSV,
      });

      const result = await tool.invoke({
        operation: "statistics",
        filePath: "data.csv",
        column: "age",
      });

      expect(result).not.toContain("Error:");
    });
  });

  describe("filter", () => {
    it("should filter data by condition", async () => {
      await createTestFiles(workspaceRoot, {
        "data.csv": SAMPLE_CSV,
      });

      const result = await tool.invoke({
        operation: "filter",
        filePath: "data.csv",
        filterColumn: "age",
        filterOperator: "gt",
        filterValue: 30,
      });

      expect(result).not.toContain("Error:");
    });

    it("should filter with equals operator", async () => {
      await createTestFiles(workspaceRoot, {
        "data.csv": SAMPLE_CSV,
      });

      const result = await tool.invoke({
        operation: "filter",
        filePath: "data.csv",
        filterColumn: "city",
        filterOperator: "eq",
        filterValue: "New York",
      });

      expect(result).not.toContain("Error:");
    });
  });

  describe("sort", () => {
    it("should sort data ascending", async () => {
      await createTestFiles(workspaceRoot, {
        "data.csv": SAMPLE_CSV,
      });

      const result = await tool.invoke({
        operation: "sort",
        filePath: "data.csv",
        sortColumn: "age",
        sortOrder: "asc",
      });

      expect(result).not.toContain("Error:");
    });

    it("should sort data descending", async () => {
      await createTestFiles(workspaceRoot, {
        "data.csv": SAMPLE_CSV,
      });

      const result = await tool.invoke({
        operation: "sort",
        filePath: "data.csv",
        sortColumn: "age",
        sortOrder: "desc",
      });

      expect(result).not.toContain("Error:");
    });
  });

  describe("group_by", () => {
    it("should group data by column", async () => {
      await createTestFiles(workspaceRoot, {
        "data.csv": `category,value
A,10
A,20
B,30
B,40
B,50`,
      });

      const result = await tool.invoke({
        operation: "group_by",
        filePath: "data.csv",
        groupByColumn: "category",
        aggregateColumn: "value",
        aggregateFunc: "sum",
      });

      expect(result).not.toContain("Error:");
    });
  });

  describe("correlation", () => {
    it("should calculate correlation between columns", async () => {
      await createTestFiles(workspaceRoot, {
        "data.csv": SAMPLE_CSV,
      });

      const result = await tool.invoke({
        operation: "correlation",
        filePath: "data.csv",
        columns: ["age", "salary"],
      });

      expect(result).not.toContain("Error:");
    });
  });

  describe("transform", () => {
    it("should transform a column", async () => {
      await createTestFiles(workspaceRoot, {
        "data.csv": SAMPLE_CSV,
      });

      const result = await tool.invoke({
        operation: "transform",
        filePath: "data.csv",
        transformColumn: "age",
        transformType: "normalize",
        newColumnName: "age_normalized",
      });

      expect(result).not.toContain("Error:");
    });
  });

  describe("outliers", () => {
    it("should detect outliers using IQR method", async () => {
      await createTestFiles(workspaceRoot, {
        "data.csv": `value
10
11
12
13
100
14
15`,
      });

      const result = await tool.invoke({
        operation: "outliers",
        filePath: "data.csv",
        column: "value",
        outlierMethod: "iqr",
      });

      expect(result).not.toContain("Error:");
    });
  });

  describe("status events", () => {
    it("should emit tool_start and tool_end events", async () => {
      await createTestFiles(workspaceRoot, {
        "data.csv": SAMPLE_CSV,
      });

      await tool.invoke({
        operation: "read_csv",
        filePath: "data.csv",
      });

      expect(events.some((e) => e.stage === "tool_start")).toBe(true);
      expect(events.some((e) => e.stage === "tool_end")).toBe(true);
    });
  });
});
