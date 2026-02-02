import { tool } from "@langchain/core/tools";
import { z } from "zod";
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";

function resolveWorkspacePath(workspaceRoot, targetPath) {
  const cleaned = targetPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const absolute = path.resolve(workspaceRoot, cleaned);
  const relative = path.relative(workspaceRoot, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path escapes workspace root.");
  }
  return absolute;
}

const ExcelOperationSchema = z.object({
  operation: z.enum([
    "create",
    "read",
    "analyze",
    "add_sheet",
    "write_formula",
    "conditional_format",
    "csv_to_excel",
    "excel_to_csv",
    "merge_files",
    "pivot_summary"
  ]).describe("The operation to perform"),
  filePath: z.string().describe("Path to the Excel file (relative to workspace)"),
  sheetName: z.string().optional().describe("Name of the worksheet"),
  data: z.array(z.array(z.any())).optional().describe("Data to write (array of rows)"),
  headers: z.array(z.string()).optional().describe("Column headers"),
  formulas: z.array(z.object({
    cell: z.string(),
    formula: z.string(),
  })).optional().describe("Array of {cell, formula} to write"),
  conditionalRules: z.array(z.object({
    range: z.string(),
    type: z.enum(["greaterThan", "lessThan", "between", "containsText", "colorScale"]),
    value: z.any(),
    style: z.object({
      fill: z.string().optional(),
      font: z.object({ color: z.string(), bold: z.boolean().optional() }).optional(),
    }).optional(),
  })).optional().describe("Conditional formatting rules"),
  csvPath: z.string().optional().describe("Path to CSV file for conversion"),
  mergeFiles: z.array(z.string()).optional().describe("Array of Excel file paths to merge"),
  pivotConfig: z.object({
    groupBy: z.string().optional(),
    aggregateColumn: z.string().optional(),
    aggregateFunc: z.enum(["sum", "avg", "count", "min", "max"]).optional(),
  }).optional().describe("Pivot table configuration"),
});

export function createExcelOperationsTool({ workspaceRoot, requestId, emitStatus }) {
  const notify = (stage, detail) => {
    if (typeof emitStatus === "function") {
      emitStatus({ stage, tool: "excel_operations", detail, requestId });
    }
  };

  return tool(
    async (params) => {
      const {
        operation,
        filePath,
        sheetName,
        data,
        headers,
        formulas,
        conditionalRules,
        csvPath,
        mergeFiles,
        pivotConfig,
      } = params;

      notify("tool_start", { operation, filePath });

      try {
        const fullPath = resolveWorkspacePath(workspaceRoot, filePath);

        switch (operation) {
          case "create": {
            const workbook = new ExcelJS.Workbook();
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
            notify("tool_end", { operation });
            return `Excel file created successfully at ${filePath}`;
          }

          case "read": {
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }
            const workbook = new ExcelJS.Workbook();
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

            notify("tool_end", { operation });
            return JSON.stringify({
              sheetName: worksheet.name,
              rowCount: rows.length,
              sheets: workbook.worksheets.map((ws) => ws.name),
              data: rows.slice(0, 100),
            }, null, 2);
          }

          case "analyze": {
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }
            const workbook = new ExcelJS.Workbook();
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

            const headerRow = worksheet.getRow(1);
            headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
              const column = worksheet.getColumn(colNumber);
              let numericCount = 0;
              let textCount = 0;
              let sum = 0;
              let min = Infinity;
              let max = -Infinity;

              column.eachCell({ includeEmpty: false }, (c, rowNum) => {
                if (rowNum === 1) return;
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

            notify("tool_end", { operation });
            return JSON.stringify(analysis, null, 2);
          }

          case "add_sheet": {
            const workbook = new ExcelJS.Workbook();
            if (fs.existsSync(fullPath)) {
              await workbook.xlsx.readFile(fullPath);
            }

            const newSheet = workbook.addWorksheet(sheetName || `Sheet${workbook.worksheets.length + 1}`);

            if (headers) {
              newSheet.addRow(headers);
              newSheet.getRow(1).font = { bold: true };
            }

            if (data) {
              data.forEach((row) => newSheet.addRow(row));
            }

            await workbook.xlsx.writeFile(fullPath);
            notify("tool_end", { operation });
            return `Sheet "${newSheet.name}" added to ${filePath}`;
          }

          case "write_formula": {
            const workbook = new ExcelJS.Workbook();
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }
            await workbook.xlsx.readFile(fullPath);
            const worksheet = sheetName
              ? workbook.getWorksheet(sheetName)
              : workbook.worksheets[0];

            if (!worksheet || !formulas) {
              throw new Error("Worksheet or formulas not found");
            }

            for (const { cell, formula } of formulas) {
              worksheet.getCell(cell).value = { formula };
            }

            await workbook.xlsx.writeFile(fullPath);
            notify("tool_end", { operation });
            return `${formulas.length} formula(s) written to ${filePath}`;
          }

          case "conditional_format": {
            const workbook = new ExcelJS.Workbook();
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }
            await workbook.xlsx.readFile(fullPath);
            const worksheet = sheetName
              ? workbook.getWorksheet(sheetName)
              : workbook.worksheets[0];

            if (!worksheet || !conditionalRules) {
              throw new Error("Worksheet or conditional rules not found");
            }

            for (const rule of conditionalRules) {
              const cfRule = {
                type: rule.type,
                priority: 1,
              };

              if (rule.type === "colorScale") {
                cfRule.cfvo = [
                  { type: "min" },
                  { type: "percentile", value: 50 },
                  { type: "max" },
                ];
                cfRule.color = [
                  { argb: "FFF8696B" },
                  { argb: "FFFFEB84" },
                  { argb: "FF63BE7B" },
                ];
              } else {
                if (rule.value !== undefined) {
                  cfRule.formulae = [String(rule.value)];
                }
                if (rule.style) {
                  cfRule.style = {};
                  if (rule.style.fill) {
                    cfRule.style.fill = {
                      type: "pattern",
                      pattern: "solid",
                      bgColor: { argb: rule.style.fill.replace("#", "FF") },
                    };
                  }
                  if (rule.style.font) {
                    cfRule.style.font = {
                      color: { argb: rule.style.font.color?.replace("#", "FF") },
                      bold: rule.style.font.bold,
                    };
                  }
                }
              }

              worksheet.addConditionalFormatting({
                ref: rule.range,
                rules: [cfRule],
              });
            }

            await workbook.xlsx.writeFile(fullPath);
            notify("tool_end", { operation });
            return `Conditional formatting applied to ${filePath}`;
          }

          case "csv_to_excel": {
            if (!csvPath) {
              throw new Error("csvPath is required for csv_to_excel operation");
            }
            const csvFullPath = resolveWorkspacePath(workspaceRoot, csvPath);
            const csvContent = fs.readFileSync(csvFullPath, "utf-8");
            const parsed = Papa.parse(csvContent, {
              header: false,
              skipEmptyLines: true,
            });

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(sheetName || "Sheet1");

            parsed.data.forEach((row, index) => {
              worksheet.addRow(row);
              if (index === 0) {
                worksheet.getRow(1).font = { bold: true };
              }
            });

            worksheet.columns.forEach((column) => {
              let maxLength = 0;
              column.eachCell?.({ includeEmpty: true }, (cell) => {
                const cellLength = cell.value ? String(cell.value).length : 0;
                maxLength = Math.max(maxLength, cellLength);
              });
              column.width = Math.min(maxLength + 2, 50);
            });

            await workbook.xlsx.writeFile(fullPath);
            notify("tool_end", { operation });
            return `CSV converted to Excel at ${filePath}`;
          }

          case "excel_to_csv": {
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(fullPath);
            const worksheet = sheetName
              ? workbook.getWorksheet(sheetName)
              : workbook.worksheets[0];

            if (!worksheet) {
              throw new Error("Worksheet not found");
            }

            const rows = [];
            worksheet.eachRow({ includeEmpty: false }, (row) => {
              const rowData = [];
              row.eachCell({ includeEmpty: true }, (cell) => {
                rowData.push(cell.value);
              });
              rows.push(rowData);
            });

            const csv = Papa.unparse(rows);
            const csvOutputPath = csvPath
              ? resolveWorkspacePath(workspaceRoot, csvPath)
              : fullPath.replace(/\.xlsx?$/i, ".csv");

            fs.writeFileSync(csvOutputPath, csv);
            notify("tool_end", { operation });
            return `Excel converted to CSV at ${path.relative(workspaceRoot, csvOutputPath)}`;
          }

          case "merge_files": {
            if (!mergeFiles || mergeFiles.length === 0) {
              throw new Error("mergeFiles array is required");
            }

            const outputWorkbook = new ExcelJS.Workbook();
            let sheetIndex = 1;

            for (const file of mergeFiles) {
              const inputPath = resolveWorkspacePath(workspaceRoot, file);
              if (!fs.existsSync(inputPath)) continue;

              const inputWorkbook = new ExcelJS.Workbook();
              await inputWorkbook.xlsx.readFile(inputPath);

              for (const worksheet of inputWorkbook.worksheets) {
                const newSheet = outputWorkbook.addWorksheet(
                  `${path.basename(file, path.extname(file))}_${worksheet.name}`
                );

                worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
                  const newRow = newSheet.getRow(rowNumber);
                  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    newRow.getCell(colNumber).value = cell.value;
                  });
                });
              }
            }

            await outputWorkbook.xlsx.writeFile(fullPath);
            notify("tool_end", { operation });
            return `${mergeFiles.length} files merged into ${filePath}`;
          }

          case "pivot_summary": {
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }
            if (!pivotConfig) {
              throw new Error("pivotConfig is required for pivot_summary");
            }

            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(fullPath);
            const worksheet = sheetName
              ? workbook.getWorksheet(sheetName)
              : workbook.worksheets[0];

            if (!worksheet) {
              throw new Error("Worksheet not found");
            }

            // Read data into array
            const headers = [];
            const dataRows = [];
            worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
              const rowData = [];
              row.eachCell({ includeEmpty: true }, (cell) => {
                rowData.push(cell.value);
              });
              if (rowNumber === 1) {
                headers.push(...rowData);
              } else {
                dataRows.push(rowData);
              }
            });

            const { groupBy, aggregateColumn, aggregateFunc } = pivotConfig;
            const groupByIndex = headers.indexOf(groupBy);
            const aggIndex = headers.indexOf(aggregateColumn);

            if (groupByIndex === -1 || aggIndex === -1) {
              throw new Error("Invalid column names for pivot");
            }

            // Group and aggregate
            const groups = new Map();
            for (const row of dataRows) {
              const key = row[groupByIndex];
              const value = parseFloat(row[aggIndex]) || 0;
              if (!groups.has(key)) {
                groups.set(key, []);
              }
              groups.get(key).push(value);
            }

            const result = [];
            for (const [key, values] of groups) {
              let aggregated;
              switch (aggregateFunc) {
                case "sum":
                  aggregated = values.reduce((a, b) => a + b, 0);
                  break;
                case "avg":
                  aggregated = values.reduce((a, b) => a + b, 0) / values.length;
                  break;
                case "count":
                  aggregated = values.length;
                  break;
                case "min":
                  aggregated = Math.min(...values);
                  break;
                case "max":
                  aggregated = Math.max(...values);
                  break;
                default:
                  aggregated = values.reduce((a, b) => a + b, 0);
              }
              result.push({ [groupBy]: key, [aggregateColumn]: aggregated });
            }

            notify("tool_end", { operation });
            return JSON.stringify({
              pivot: result,
              groupBy,
              aggregateColumn,
              aggregateFunc: aggregateFunc || "sum",
            }, null, 2);
          }

          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      } catch (error) {
        notify("tool_error", { error: error.message });
        return `Error: ${error.message}`;
      }
    },
    {
      name: "excel_operations",
      description: "Comprehensive Excel operations: create, read, analyze, add sheets, write formulas, conditional formatting, CSV conversion, merge files, and pivot summaries.",
      schema: ExcelOperationSchema,
    }
  );
}
