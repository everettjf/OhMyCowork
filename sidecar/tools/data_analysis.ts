// @ts-nocheck
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import Papa from "papaparse";
import * as ss from "simple-statistics";
import fs from "node:fs";
import path from "node:path";

function resolveWorkspacePath(workspaceRoot, targetPath) {
  const cleaned = targetPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const absolute = path.resolve(workspaceRoot, cleaned);
  const relative = path.relative(workspaceRoot, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path escapes workspace root.");
  }
  return absolute;
}

const DataAnalysisSchema = z.object({
  operation: z.enum([
    "read_csv",
    "describe",
    "statistics",
    "correlation",
    "group_by",
    "filter",
    "sort",
    "pivot",
    "outliers",
    "write_csv",
    "merge_datasets",
    "transform",
  ]).describe("The operation to perform"),
  filePath: z.string().describe("Path to the data file (relative to workspace)"),
  // CSV options
  delimiter: z.string().optional(),
  hasHeader: z.boolean().optional(),
  // Column selection
  columns: z.array(z.string()).optional().describe("Columns to include"),
  // Statistics options
  column: z.string().optional().describe("Column name for analysis"),
  // Group by options
  groupByColumn: z.string().optional(),
  aggregateColumn: z.string().optional(),
  aggregateFunc: z.enum(["sum", "mean", "count", "min", "max", "median", "std"]).optional(),
  // Filter options
  filterColumn: z.string().optional(),
  filterOperator: z.enum(["eq", "ne", "gt", "lt", "gte", "lte", "contains", "startsWith", "endsWith"]).optional(),
  filterValue: z.unknown().optional(),
  // Sort options
  sortColumn: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  // Pivot options
  pivotRows: z.string().optional(),
  pivotCols: z.string().optional(),
  pivotValues: z.string().optional(),
  pivotAggFunc: z.enum(["sum", "mean", "count", "min", "max"]).optional(),
  // Outlier detection
  outlierMethod: z.enum(["zscore", "iqr"]).optional(),
  outlierThreshold: z.number().optional(),
  // Output options
  outputPath: z.string().optional(),
  limit: z.number().optional().describe("Limit number of rows returned"),
  // Merge options
  mergeFile: z.string().optional(),
  mergeOn: z.string().optional(),
  mergeHow: z.enum(["inner", "left", "right", "outer"]).optional(),
  // Transform options
  transformColumn: z.string().optional(),
  transformType: z.enum(["normalize", "standardize", "log", "round", "abs", "uppercase", "lowercase"]).optional(),
  newColumnName: z.string().optional(),
});

export function createDataAnalysisTool({ workspaceRoot, requestId, emitStatus }) {
  const notify = (stage, detail) => {
    if (typeof emitStatus === "function") {
      emitStatus({ stage, tool: "data_analysis", detail, requestId });
    }
  };

  const parseCSV = (content, options = {}) => {
    return Papa.parse(content, {
      header: options.hasHeader !== false,
      delimiter: options.delimiter || ",",
      skipEmptyLines: true,
      dynamicTyping: true,
    });
  };

  return tool(
    async (params) => {
      const {
        operation,
        filePath,
        delimiter,
        hasHeader,
        columns,
        column,
        groupByColumn,
        aggregateColumn,
        aggregateFunc,
        filterColumn,
        filterOperator,
        filterValue,
        sortColumn,
        sortOrder,
        pivotRows,
        pivotCols,
        pivotValues,
        pivotAggFunc,
        outlierMethod,
        outlierThreshold,
        outputPath,
        limit,
        mergeFile,
        mergeOn,
        mergeHow,
        transformColumn,
        transformType,
        newColumnName,
      } = params;

      notify("tool_start", { operation, filePath });

      try {
        const fullPath = resolveWorkspacePath(workspaceRoot, filePath);

        if (!fs.existsSync(fullPath) && operation !== "write_csv") {
          throw new Error(`File not found: ${filePath}`);
        }

        let data;
        let headers;

        if (operation !== "write_csv") {
          const content = fs.readFileSync(fullPath, "utf-8");
          const parsed = parseCSV(content, { hasHeader, delimiter });
          data = parsed.data;
          headers = hasHeader !== false ? Object.keys(data[0] || {}) : null;
        }

        switch (operation) {
          case "read_csv": {
            let result = data;

            // Select columns
            if (columns && columns.length > 0) {
              result = result.map((row) => {
                const filtered = {};
                columns.forEach((col) => {
                  if (col in row) filtered[col] = row[col];
                });
                return filtered;
              });
            }

            // Apply limit
            if (limit && limit > 0) {
              result = result.slice(0, limit);
            }

            notify("tool_end", { operation });
            return JSON.stringify({
              rowCount: data.length,
              columns: headers,
              data: result,
            }, null, 2);
          }

          case "describe": {
            const description = {
              rowCount: data.length,
              columnCount: headers?.length || 0,
              columns: {},
            };

            if (headers) {
              for (const col of headers) {
                const values = data.map((row) => row[col]).filter((v) => v != null);
                const numericValues = values.filter((v) => typeof v === "number");
                const isNumeric = numericValues.length > values.length / 2;

                description.columns[col] = {
                  type: isNumeric ? "numeric" : "string",
                  count: values.length,
                  nullCount: data.length - values.length,
                  uniqueCount: new Set(values).size,
                };

                if (isNumeric && numericValues.length > 0) {
                  description.columns[col].min = ss.min(numericValues);
                  description.columns[col].max = ss.max(numericValues);
                  description.columns[col].mean = ss.mean(numericValues);
                  description.columns[col].median = ss.median(numericValues);
                  description.columns[col].std = ss.standardDeviation(numericValues);
                }
              }
            }

            notify("tool_end", { operation });
            return JSON.stringify(description, null, 2);
          }

          case "statistics": {
            if (!column) {
              throw new Error("column is required for statistics");
            }

            const values = data
              .map((row) => row[column])
              .filter((v) => typeof v === "number" && !isNaN(v));

            if (values.length === 0) {
              throw new Error(`No numeric values found in column: ${column}`);
            }

            const stats = {
              column,
              count: values.length,
              sum: ss.sum(values),
              mean: ss.mean(values),
              median: ss.median(values),
              mode: ss.mode(values),
              min: ss.min(values),
              max: ss.max(values),
              range: ss.max(values) - ss.min(values),
              variance: ss.variance(values),
              standardDeviation: ss.standardDeviation(values),
              skewness: ss.sampleSkewness(values),
              percentiles: {
                p25: ss.quantile(values, 0.25),
                p50: ss.quantile(values, 0.50),
                p75: ss.quantile(values, 0.75),
                p90: ss.quantile(values, 0.90),
                p95: ss.quantile(values, 0.95),
                p99: ss.quantile(values, 0.99),
              },
            };

            notify("tool_end", { operation });
            return JSON.stringify(stats, null, 2);
          }

          case "correlation": {
            if (!columns || columns.length < 2) {
              throw new Error("At least 2 columns required for correlation");
            }

            const correlationMatrix = {};
            for (const col1 of columns) {
              correlationMatrix[col1] = {};
              for (const col2 of columns) {
                const values1 = data.map((row) => row[col1]).filter((v) => typeof v === "number");
                const values2 = data.map((row) => row[col2]).filter((v) => typeof v === "number");

                if (values1.length === values2.length && values1.length > 1) {
                  correlationMatrix[col1][col2] = ss.sampleCorrelation(values1, values2);
                } else {
                  correlationMatrix[col1][col2] = null;
                }
              }
            }

            notify("tool_end", { operation });
            return JSON.stringify({ columns, correlationMatrix }, null, 2);
          }

          case "group_by": {
            if (!groupByColumn) {
              throw new Error("groupByColumn is required");
            }

            const groups = new Map();
            for (const row of data) {
              const key = row[groupByColumn];
              if (!groups.has(key)) {
                groups.set(key, []);
              }
              groups.get(key).push(row);
            }

            const result = [];
            for (const [key, rows] of groups) {
              const groupResult = { [groupByColumn]: key, count: rows.length };

              if (aggregateColumn && aggregateFunc) {
                const values = rows
                  .map((r) => r[aggregateColumn])
                  .filter((v) => typeof v === "number");

                if (values.length > 0) {
                  switch (aggregateFunc) {
                    case "sum":
                      groupResult[`${aggregateColumn}_sum`] = ss.sum(values);
                      break;
                    case "mean":
                      groupResult[`${aggregateColumn}_mean`] = ss.mean(values);
                      break;
                    case "min":
                      groupResult[`${aggregateColumn}_min`] = ss.min(values);
                      break;
                    case "max":
                      groupResult[`${aggregateColumn}_max`] = ss.max(values);
                      break;
                    case "median":
                      groupResult[`${aggregateColumn}_median`] = ss.median(values);
                      break;
                    case "std":
                      groupResult[`${aggregateColumn}_std`] = ss.standardDeviation(values);
                      break;
                    case "count":
                      groupResult[`${aggregateColumn}_count`] = values.length;
                      break;
                  }
                }
              }

              result.push(groupResult);
            }

            notify("tool_end", { operation });
            return JSON.stringify({ groups: result }, null, 2);
          }

          case "filter": {
            if (!filterColumn || !filterOperator) {
              throw new Error("filterColumn and filterOperator are required");
            }

            let filtered = data.filter((row) => {
              const val = row[filterColumn];
              switch (filterOperator) {
                case "eq": return val === filterValue;
                case "ne": return val !== filterValue;
                case "gt": return val > filterValue;
                case "lt": return val < filterValue;
                case "gte": return val >= filterValue;
                case "lte": return val <= filterValue;
                case "contains": return String(val).includes(String(filterValue));
                case "startsWith": return String(val).startsWith(String(filterValue));
                case "endsWith": return String(val).endsWith(String(filterValue));
                default: return true;
              }
            });

            if (limit && limit > 0) {
              filtered = filtered.slice(0, limit);
            }

            notify("tool_end", { operation });
            return JSON.stringify({
              originalCount: data.length,
              filteredCount: filtered.length,
              data: filtered,
            }, null, 2);
          }

          case "sort": {
            if (!sortColumn) {
              throw new Error("sortColumn is required");
            }

            const sorted = [...data].sort((a, b) => {
              const valA = a[sortColumn];
              const valB = b[sortColumn];

              if (valA === valB) return 0;
              if (valA == null) return 1;
              if (valB == null) return -1;

              const cmp = valA < valB ? -1 : 1;
              return sortOrder === "desc" ? -cmp : cmp;
            });

            const result = limit && limit > 0 ? sorted.slice(0, limit) : sorted;

            notify("tool_end", { operation });
            return JSON.stringify({ data: result }, null, 2);
          }

          case "pivot": {
            if (!pivotRows || !pivotValues) {
              throw new Error("pivotRows and pivotValues are required");
            }

            const pivot = new Map();
            const colValues = new Set();

            for (const row of data) {
              const rowKey = row[pivotRows];
              const colKey = pivotCols ? row[pivotCols] : "value";
              const value = row[pivotValues];

              if (!pivot.has(rowKey)) {
                pivot.set(rowKey, new Map());
              }
              const rowMap = pivot.get(rowKey);

              if (!rowMap.has(colKey)) {
                rowMap.set(colKey, []);
              }
              if (typeof value === "number") {
                rowMap.get(colKey).push(value);
              }

              colValues.add(colKey);
            }

            const result = [];
            for (const [rowKey, rowMap] of pivot) {
              const pivotRow = { [pivotRows]: rowKey };
              for (const colKey of colValues) {
                const values = rowMap.get(colKey) || [];
                if (values.length > 0) {
                  switch (pivotAggFunc || "sum") {
                    case "sum":
                      pivotRow[colKey] = ss.sum(values);
                      break;
                    case "mean":
                      pivotRow[colKey] = ss.mean(values);
                      break;
                    case "count":
                      pivotRow[colKey] = values.length;
                      break;
                    case "min":
                      pivotRow[colKey] = ss.min(values);
                      break;
                    case "max":
                      pivotRow[colKey] = ss.max(values);
                      break;
                  }
                }
              }
              result.push(pivotRow);
            }

            notify("tool_end", { operation });
            return JSON.stringify({ pivot: result }, null, 2);
          }

          case "outliers": {
            if (!column) {
              throw new Error("column is required for outlier detection");
            }

            const values = data
              .map((row, index) => ({ value: row[column], index, row }))
              .filter((item) => typeof item.value === "number");

            const numericValues = values.map((v) => v.value);
            const method = outlierMethod || "zscore";
            const threshold = outlierThreshold || (method === "zscore" ? 3 : 1.5);

            let outliers;
            if (method === "zscore") {
              const mean = ss.mean(numericValues);
              const std = ss.standardDeviation(numericValues);
              outliers = values.filter((item) => Math.abs((item.value - mean) / std) > threshold);
            } else {
              // IQR method
              const q1 = ss.quantile(numericValues, 0.25);
              const q3 = ss.quantile(numericValues, 0.75);
              const iqr = q3 - q1;
              const lower = q1 - threshold * iqr;
              const upper = q3 + threshold * iqr;
              outliers = values.filter((item) => item.value < lower || item.value > upper);
            }

            notify("tool_end", { operation });
            return JSON.stringify({
              column,
              method,
              threshold,
              totalRows: data.length,
              outlierCount: outliers.length,
              outliers: outliers.map((o) => ({
                index: o.index,
                value: o.value,
                row: o.row,
              })),
            }, null, 2);
          }

          case "write_csv": {
            if (!outputPath) {
              throw new Error("outputPath is required for write_csv");
            }
            // data should be passed through params
            throw new Error("write_csv requires data to be passed. Use transform or other operations first.");
          }

          case "merge_datasets": {
            if (!mergeFile || !mergeOn) {
              throw new Error("mergeFile and mergeOn are required");
            }

            const mergeFullPath = resolveWorkspacePath(workspaceRoot, mergeFile);
            if (!fs.existsSync(mergeFullPath)) {
              throw new Error(`Merge file not found: ${mergeFile}`);
            }

            const mergeContent = fs.readFileSync(mergeFullPath, "utf-8");
            const mergeParsed = parseCSV(mergeContent, { hasHeader, delimiter });
            const mergeData = mergeParsed.data;

            const mergeIndex = new Map();
            for (const row of mergeData) {
              mergeIndex.set(row[mergeOn], row);
            }

            const how = mergeHow || "inner";
            const result = [];

            for (const row of data) {
              const key = row[mergeOn];
              const mergeRow = mergeIndex.get(key);

              if (mergeRow) {
                result.push({ ...row, ...mergeRow });
              } else if (how === "left" || how === "outer") {
                result.push(row);
              }
            }

            if (how === "right" || how === "outer") {
              for (const row of mergeData) {
                const key = row[mergeOn];
                const exists = data.some((d) => d[mergeOn] === key);
                if (!exists) {
                  result.push(row);
                }
              }
            }

            notify("tool_end", { operation });
            return JSON.stringify({
              leftCount: data.length,
              rightCount: mergeData.length,
              resultCount: result.length,
              data: limit ? result.slice(0, limit) : result,
            }, null, 2);
          }

          case "transform": {
            if (!transformColumn || !transformType) {
              throw new Error("transformColumn and transformType are required");
            }

            const targetCol = newColumnName || `${transformColumn}_${transformType}`;
            const transformed = data.map((row) => {
              const value = row[transformColumn];
              const newRow = { ...row };

              switch (transformType) {
                case "normalize": {
                  const values = data.map((r) => r[transformColumn]).filter((v) => typeof v === "number");
                  const min = ss.min(values);
                  const max = ss.max(values);
                  newRow[targetCol] = typeof value === "number" ? (value - min) / (max - min) : null;
                  break;
                }
                case "standardize": {
                  const values = data.map((r) => r[transformColumn]).filter((v) => typeof v === "number");
                  const mean = ss.mean(values);
                  const std = ss.standardDeviation(values);
                  newRow[targetCol] = typeof value === "number" ? (value - mean) / std : null;
                  break;
                }
                case "log":
                  newRow[targetCol] = typeof value === "number" && value > 0 ? Math.log(value) : null;
                  break;
                case "round":
                  newRow[targetCol] = typeof value === "number" ? Math.round(value) : value;
                  break;
                case "abs":
                  newRow[targetCol] = typeof value === "number" ? Math.abs(value) : value;
                  break;
                case "uppercase":
                  newRow[targetCol] = typeof value === "string" ? value.toUpperCase() : value;
                  break;
                case "lowercase":
                  newRow[targetCol] = typeof value === "string" ? value.toLowerCase() : value;
                  break;
              }

              return newRow;
            });

            // Save if outputPath provided
            if (outputPath) {
              const csv = Papa.unparse(transformed);
              const outFullPath = resolveWorkspacePath(workspaceRoot, outputPath);
              fs.writeFileSync(outFullPath, csv);
            }

            notify("tool_end", { operation });
            return JSON.stringify({
              transformedColumn: targetCol,
              rowCount: transformed.length,
              data: limit ? transformed.slice(0, limit) : transformed.slice(0, 20),
              savedTo: outputPath || null,
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
      name: "data_analysis",
      description: "Comprehensive data analysis: read CSV, describe data, compute statistics, correlations, group by aggregations, filter, sort, pivot tables, detect outliers, merge datasets, and transform columns (normalize, standardize, log, etc.).",
      schema: DataAnalysisSchema,
    }
  );
}
