import { tool } from "@langchain/core/tools";
import { z } from "zod";
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";

const ExcelOperationSchema = z.object({
  operation: z.enum(["create", "read", "analyze", "add_chart"]).describe("The operation to perform"),
  filePath: z.string().describe("Path to the Excel file (relative to workspace)"),
  sheetName: z.string().optional().describe("Name of the worksheet"),
  data: z.array(z.array(z.any())).optional().describe("Data to write (array of rows)"),
  headers: z.array(z.string()).optional().describe("Column headers"),
  chartConfig: z.object({
    type: z.enum(["bar", "line", "pie", "column"]).optional(),
    title: z.string().optional(),
    dataRange: z.string().optional(),
  }).optional().describe("Chart configuration"),
});

export function createExcelOperationsTool({ workspaceRoot, requestId, emitStatus }) {
  return tool(
    async ({ operation, filePath, sheetName, data, headers, chartConfig }) => {
      emitStatus?.({ stage: "tool_start", tool: "excel_operations", detail: { operation, filePath } });

      try {
        const fullPath = path.join(workspaceRoot, filePath);
        const workbook = new ExcelJS.Workbook();

        switch (operation) {
          case "create": {
            const worksheet = workbook.addWorksheet(sheetName || "Sheet1");

            if (headers) {
              worksheet.addRow(headers);
              worksheet.getRow(1).font = { bold: true };
              worksheet.getRow(1).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFE0E0E0" },
              };
            }

            if (data) {
              data.forEach((row) => worksheet.addRow(row));
            }

            // Auto-fit columns
            worksheet.columns.forEach((column) => {
              let maxLength = 0;
              column.eachCell?.({ includeEmpty: true }, (cell) => {
                const cellLength = cell.value ? String(cell.value).length : 0;
                maxLength = Math.max(maxLength, cellLength);
              });
              column.width = Math.min(maxLength + 2, 50);
            });

            await workbook.xlsx.writeFile(fullPath);
            emitStatus?.({ stage: "tool_end", tool: "excel_operations" });
            return `Excel file created successfully at ${filePath}`;
          }

          case "read": {
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }
            await workbook.xlsx.readFile(fullPath);
            const worksheet = sheetName
              ? workbook.getWorksheet(sheetName)
              : workbook.worksheets[0];

            if (!worksheet) {
              throw new Error(`Worksheet not found: ${sheetName || "default"}`);
            }

            const rows = [];
            worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
              const rowData = [];
              row.eachCell({ includeEmpty: true }, (cell) => {
                rowData.push(cell.value);
              });
              rows.push({ row: rowNumber, data: rowData });
            });

            emitStatus?.({ stage: "tool_end", tool: "excel_operations" });
            return JSON.stringify({
              sheetName: worksheet.name,
              rowCount: rows.length,
              data: rows.slice(0, 100), // Limit to 100 rows
            }, null, 2);
          }

          case "analyze": {
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }
            await workbook.xlsx.readFile(fullPath);
            const worksheet = sheetName
              ? workbook.getWorksheet(sheetName)
              : workbook.worksheets[0];

            if (!worksheet) {
              throw new Error(`Worksheet not found`);
            }

            const analysis = {
              sheetName: worksheet.name,
              rowCount: worksheet.rowCount,
              columnCount: worksheet.columnCount,
              sheets: workbook.worksheets.map((ws) => ws.name),
              columns: [],
            };

            // Analyze first row as headers
            const headerRow = worksheet.getRow(1);
            headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
              const column = worksheet.getColumn(colNumber);
              let numericCount = 0;
              let textCount = 0;
              let sum = 0;
              let min = Infinity;
              let max = -Infinity;

              column.eachCell({ includeEmpty: false }, (c, rowNum) => {
                if (rowNum === 1) return; // Skip header
                const val = c.value;
                if (typeof val === "number") {
                  numericCount++;
                  sum += val;
                  min = Math.min(min, val);
                  max = Math.max(max, val);
                } else if (val) {
                  textCount++;
                }
              });

              analysis.columns.push({
                header: cell.value,
                type: numericCount > textCount ? "numeric" : "text",
                nonEmptyCount: numericCount + textCount,
                ...(numericCount > 0 && {
                  sum,
                  average: sum / numericCount,
                  min: min === Infinity ? null : min,
                  max: max === -Infinity ? null : max,
                }),
              });
            });

            emitStatus?.({ stage: "tool_end", tool: "excel_operations" });
            return JSON.stringify(analysis, null, 2);
          }

          case "add_chart": {
            // Note: ExcelJS has limited chart support
            // For full chart support, consider using xlsx-chart or similar
            emitStatus?.({ stage: "tool_end", tool: "excel_operations" });
            return "Chart functionality requires additional implementation. Consider using Excel formulas for now.";
          }

          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      } catch (error) {
        emitStatus?.({ stage: "tool_error", tool: "excel_operations", detail: { error: error.message } });
        return `Error: ${error.message}`;
      }
    },
    {
      name: "excel_operations",
      description: "Create, read, and analyze Excel spreadsheets. Supports creating files with data and headers, reading existing files, and analyzing column statistics.",
      schema: ExcelOperationSchema,
    }
  );
}
