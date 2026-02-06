import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { hashFile } from "hasha";
import pLimit from "p-limit";
import filenamify from "filenamify";
import { ToolContext, createNotifier, resolveWorkspacePath } from "./types.js";

interface FileInfo {
  path: string;
  size?: number;
  modified?: string;
  isDirectory?: boolean;
  error?: string;
}

interface RenameResult {
  original: string;
  renamed?: string;
  wouldRenameTo?: string;
  success?: boolean;
  error?: string;
  dryRun?: boolean;
}

interface DuplicateGroup {
  hash: string;
  files: string[];
  count: number;
}

interface FolderItem {
  name: string;
  children?: FolderItem[] | string[];
}

interface DeleteResult {
  path: string;
  deleted?: boolean;
  wouldDelete?: boolean;
  error?: string;
}

// Recursive schema so OpenAI function-calling gets valid JSON Schema `items`.
const FolderStructureItemSchema: z.ZodTypeAny = z.lazy(() =>
  z.union([
    z.string(),
    z.object({
      name: z.string(),
      children: z.array(FolderStructureItemSchema).optional(),
    }),
  ])
);

// File search and filter tool
export function createFileSearchTool({ workspaceRoot, requestId, emitStatus }: ToolContext) {
  const notify = createNotifier("file_search", emitStatus, requestId);

  return tool(
    async ({
      pattern,
      path: searchPath,
      ignore,
      maxResults,
    }: {
      pattern: string;
      path?: string;
      ignore?: string[];
      maxResults?: number;
    }) => {
      notify("tool_start", { pattern, path: searchPath });
      try {
        if (!workspaceRoot) {
          throw new Error("workspaceRoot is required");
        }

        const basePath = searchPath
          ? resolveWorkspacePath(workspaceRoot, searchPath)
          : workspaceRoot;

        const ignorePatterns = ignore || ["**/node_modules/**", "**/.git/**"];

        const files = await fg(pattern, {
          cwd: basePath,
          ignore: ignorePatterns,
          dot: false,
          onlyFiles: true,
          absolute: false,
        });

        const results = files.slice(0, maxResults || 100);

        // Get file info for each result
        const fileInfos: FileInfo[] = await Promise.all(
          results.map(async (file) => {
            const fullPath = path.join(basePath, file);
            try {
              const stat = await fs.stat(fullPath);
              return {
                path: file,
                size: stat.size,
                modified: stat.mtime.toISOString(),
                isDirectory: stat.isDirectory(),
              };
            } catch {
              return { path: file, error: "Could not read file info" };
            }
          })
        );

        notify("tool_end", { total: files.length, files: fileInfos });
        return JSON.stringify({ files: fileInfos, total: files.length }, null, 2);
      } catch (error) {
        const err = error as Error;
        notify("tool_error", { error: err.message });
        return `Error: ${err.message}`;
      }
    },
    {
      name: "file_search",
      description: "Search for files using glob patterns. Returns matching files with metadata.",
      schema: z.object({
        pattern: z.string().describe("Glob pattern (e.g., '**/*.txt', 'src/**/*.js')"),
        path: z.string().optional().describe("Base path to search from (workspace-relative)"),
        ignore: z.array(z.string()).optional().describe("Patterns to ignore"),
        maxResults: z.number().optional().describe("Maximum number of results (default 100)"),
      }),
    }
  );
}

// Batch file rename tool
export function createFileRenameTool({ workspaceRoot, requestId, emitStatus }: ToolContext) {
  const notify = createNotifier("file_rename", emitStatus, requestId);

  return tool(
    async ({
      files,
      pattern,
      replacement,
      prefix,
      suffix,
      sanitize,
      dryRun,
    }: {
      files: string[];
      pattern?: string;
      replacement?: string;
      prefix?: string;
      suffix?: string;
      sanitize?: boolean;
      dryRun?: boolean;
    }) => {
      notify("tool_start", { fileCount: files?.length, pattern, replacement });
      try {
        if (!workspaceRoot) {
          throw new Error("workspaceRoot is required");
        }

        const results: RenameResult[] = [];
        const limit = pLimit(5); // Limit concurrent operations

        const renameOps = files.map((file) =>
          limit(async () => {
            const fullPath = resolveWorkspacePath(workspaceRoot, file);
            const dir = path.dirname(fullPath);
            let baseName = path.basename(fullPath, path.extname(fullPath));
            const ext = path.extname(fullPath);

            // Apply pattern replacement
            if (pattern && replacement !== undefined) {
              const regex = new RegExp(pattern, "g");
              baseName = baseName.replace(regex, replacement);
            }

            // Apply prefix/suffix
            if (prefix) baseName = prefix + baseName;
            if (suffix) baseName = baseName + suffix;

            // Sanitize filename if requested
            if (sanitize) {
              baseName = filenamify(baseName, { replacement: "_" });
            }

            const newName = baseName + ext;
            const newPath = path.join(dir, newName);
            const relativePath = path.relative(workspaceRoot, newPath);

            if (!dryRun) {
              try {
                await fs.rename(fullPath, newPath);
                results.push({
                  original: file,
                  renamed: relativePath,
                  success: true,
                });
              } catch (error) {
                const err = error as Error;
                results.push({
                  original: file,
                  error: err.message,
                  success: false,
                });
              }
            } else {
              results.push({
                original: file,
                wouldRenameTo: relativePath,
                dryRun: true,
              });
            }
          })
        );

        await Promise.all(renameOps);
        notify("tool_end", { renamed: results.filter((r) => r.success).length });
        return JSON.stringify({ results, dryRun: !!dryRun }, null, 2);
      } catch (error) {
        const err = error as Error;
        notify("tool_error", { error: err.message });
        return `Error: ${err.message}`;
      }
    },
    {
      name: "file_rename",
      description: "Batch rename files with pattern replacement, prefix/suffix, and sanitization options.",
      schema: z.object({
        files: z.array(z.string()).describe("Array of file paths to rename (workspace-relative)"),
        pattern: z.string().optional().describe("Regex pattern to match in filename"),
        replacement: z.string().optional().describe("Replacement string for pattern"),
        prefix: z.string().optional().describe("Prefix to add to filename"),
        suffix: z.string().optional().describe("Suffix to add before extension"),
        sanitize: z.boolean().optional().describe("Sanitize illegal characters from filename"),
        dryRun: z.boolean().optional().describe("Preview changes without renaming"),
      }),
    }
  );
}

// Find duplicate files tool
export function createFindDuplicatesTool({ workspaceRoot, requestId, emitStatus }: ToolContext) {
  const notify = createNotifier("find_duplicates", emitStatus, requestId);

  return tool(
    async ({
      path: searchPath,
      deleteAction,
      confirmDelete,
      minSize,
    }: {
      path?: string;
      deleteAction?: "report" | "delete_duplicates";
      confirmDelete?: boolean;
      minSize?: number;
    }) => {
      notify("tool_start", { path: searchPath, deleteAction });
      try {
        if (!workspaceRoot) {
          throw new Error("workspaceRoot is required");
        }

        const basePath = searchPath
          ? resolveWorkspacePath(workspaceRoot, searchPath)
          : workspaceRoot;

        // Find all files
        const files = await fg("**/*", {
          cwd: basePath,
          ignore: ["**/node_modules/**", "**/.git/**"],
          onlyFiles: true,
          absolute: true,
        });

        // Filter by minimum size
        const minBytes = minSize || 0;
        const fileStats = await Promise.all(
          files.map(async (file) => {
            try {
              const stat = await fs.stat(file);
              return { path: file, size: stat.size };
            } catch {
              return null;
            }
          })
        );
        const validFiles = fileStats.filter((f): f is { path: string; size: number } => f !== null && f.size >= minBytes);

        // Group files by size first (optimization)
        const sizeGroups = new Map<string, string[]>();
        for (const file of validFiles) {
          const key = file.size.toString();
          if (!sizeGroups.has(key)) sizeGroups.set(key, []);
          sizeGroups.get(key)!.push(file.path);
        }

        // Hash files that have same size
        const duplicateGroups: DuplicateGroup[] = [];
        const limit = pLimit(5);

        for (const [, paths] of sizeGroups) {
          if (paths.length < 2) continue;

          const hashMap = new Map<string, string[]>();
          await Promise.all(
            paths.map((filePath) =>
              limit(async () => {
                try {
                  const hash = await hashFile(filePath, { algorithm: "md5" });
                  if (!hashMap.has(hash)) hashMap.set(hash, []);
                  hashMap.get(hash)!.push(filePath);
                } catch {
                  // Skip files that can't be hashed
                }
              })
            )
          );

          for (const [hash, duplicatePaths] of hashMap) {
            if (duplicatePaths.length > 1) {
              duplicateGroups.push({
                hash,
                files: duplicatePaths.map((p) => path.relative(workspaceRoot, p)),
                count: duplicatePaths.length,
              });
            }
          }
        }

        // Delete duplicates if requested (keep first file in each group)
        const deleted: string[] = [];
        if (deleteAction === "delete_duplicates") {
          if (!confirmDelete) {
            return JSON.stringify({
              duplicateGroups,
              totalDuplicateFiles: duplicateGroups.reduce((sum, g) => sum + g.count - 1, 0),
              action: "report",
              warning:
                "Deletion requires explicit confirmation. Re-run with deleteAction='delete_duplicates' and confirmDelete=true.",
            }, null, 2);
          }
          for (const group of duplicateGroups) {
            const toDelete = group.files.slice(1); // Keep first
            for (const file of toDelete) {
              try {
                await fs.unlink(resolveWorkspacePath(workspaceRoot, file));
                deleted.push(file);
              } catch {
                // Skip files that can't be deleted
              }
            }
          }
        }

        notify("tool_end", {
          groups: duplicateGroups.length,
          deleted: deleted.length
        });

        return JSON.stringify({
          duplicateGroups,
          totalDuplicateFiles: duplicateGroups.reduce((sum, g) => sum + g.count - 1, 0),
          deleted,
          action: deleteAction || "report",
        }, null, 2);
      } catch (error) {
        const err = error as Error;
        notify("tool_error", { error: err.message });
        return `Error: ${err.message}`;
      }
    },
    {
      name: "find_duplicates",
      description: "Find duplicate files by content hash. Optionally delete duplicates (keeps first file).",
      schema: z.object({
        path: z.string().optional().describe("Path to search (workspace-relative, default: root)"),
        deleteAction: z.enum(["report", "delete_duplicates"]).optional().describe("Action: report only or delete duplicates"),
        confirmDelete: z.boolean().optional().describe("Required true when deleteAction is delete_duplicates"),
        minSize: z.number().optional().describe("Minimum file size in bytes to consider"),
      }),
    }
  );
}

// Create folder structure tool
export function createFolderStructureTool({ workspaceRoot, requestId, emitStatus }: ToolContext) {
  const notify = createNotifier("create_folders", emitStatus, requestId);

  return tool(
    async ({
      structure,
      basePath,
    }: {
      structure: (string | FolderItem)[];
      basePath?: string;
    }) => {
      notify("tool_start", { structure, basePath });
      try {
        if (!workspaceRoot) {
          throw new Error("workspaceRoot is required");
        }

        const base = basePath
          ? resolveWorkspacePath(workspaceRoot, basePath)
          : workspaceRoot;

        const created: string[] = [];
        const errors: { path: string; error: string }[] = [];

        const createRecursive = async (folders: (string | FolderItem)[], parentPath: string) => {
          for (const folder of folders) {
            const name = typeof folder === "string" ? folder : folder.name;
            const children = typeof folder === "object" ? folder.children : null;

            const folderPath = path.join(parentPath, name);
            try {
              await fs.mkdir(folderPath, { recursive: true });
              created.push(path.relative(workspaceRoot, folderPath));

              if (children && Array.isArray(children)) {
                await createRecursive(children as (string | FolderItem)[], folderPath);
              }
            } catch (error) {
              const err = error as Error;
              errors.push({
                path: path.relative(workspaceRoot, folderPath),
                error: err.message,
              });
            }
          }
        };

        await createRecursive(structure, base);

        notify("tool_end", { created: created.length, errors: errors.length });
        return JSON.stringify({ created, errors }, null, 2);
      } catch (error) {
        const err = error as Error;
        notify("tool_error", { error: err.message });
        return `Error: ${err.message}`;
      }
    },
    {
      name: "create_folders",
      description: "Create folder structures from a specification. Supports nested structures.",
      schema: z.object({
        structure: z
          .array(FolderStructureItemSchema)
          .describe("Folder structure: array of names or {name, children} objects"),
        basePath: z.string().optional().describe("Base path to create structure in"),
      }),
    }
  );
}

// Helper to copy directory recursively
async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

// File copy/move tool
export function createFileCopyMoveTool({ workspaceRoot, requestId, emitStatus }: ToolContext) {
  const notify = createNotifier("file_copy_move", emitStatus, requestId);

  return tool(
    async ({
      operation,
      source,
      destination,
      overwrite,
    }: {
      operation: "copy" | "move";
      source: string;
      destination: string;
      overwrite?: boolean;
    }) => {
      notify("tool_start", { operation, source, destination });
      try {
        if (!workspaceRoot) {
          throw new Error("workspaceRoot is required");
        }

        const srcPath = resolveWorkspacePath(workspaceRoot, source);
        const destPath = resolveWorkspacePath(workspaceRoot, destination);

        // Check if source exists
        const srcStat = await fs.stat(srcPath);

        // Check destination
        let destExists = false;
        try {
          await fs.access(destPath);
          destExists = true;
        } catch {
          // Destination doesn't exist
        }

        if (destExists && !overwrite) {
          return JSON.stringify({
            success: false,
            error: "Destination exists. Set overwrite: true to replace.",
          });
        }

        // Ensure destination directory exists
        await fs.mkdir(path.dirname(destPath), { recursive: true });

        if (operation === "copy") {
          if (srcStat.isDirectory()) {
            await copyDir(srcPath, destPath);
          } else {
            await fs.copyFile(srcPath, destPath);
          }
        } else if (operation === "move") {
          await fs.rename(srcPath, destPath);
        }

        notify("tool_end", { operation, source, destination });
        return JSON.stringify({
          success: true,
          operation,
          source,
          destination,
        });
      } catch (error) {
        const err = error as Error;
        notify("tool_error", { error: err.message });
        return `Error: ${err.message}`;
      }
    },
    {
      name: "file_copy_move",
      description: "Copy or move files and directories.",
      schema: z.object({
        operation: z.enum(["copy", "move"]).describe("Operation to perform"),
        source: z.string().describe("Source path (workspace-relative)"),
        destination: z.string().describe("Destination path (workspace-relative)"),
        overwrite: z.boolean().optional().describe("Overwrite if destination exists"),
      }),
    }
  );
}

// Delete files tool
export function createFileDeleteTool({ workspaceRoot, requestId, emitStatus }: ToolContext) {
  const notify = createNotifier("file_delete", emitStatus, requestId);

  return tool(
    async ({
      paths,
      pattern,
      dryRun,
      confirmDelete,
    }: {
      paths?: string[];
      pattern?: string;
      dryRun?: boolean;
      confirmDelete?: boolean;
    }) => {
      notify("tool_start", { paths, pattern, dryRun });
      try {
        if (!workspaceRoot) {
          throw new Error("workspaceRoot is required");
        }

        let filesToDelete: string[] = [];

        if (paths && paths.length > 0) {
          filesToDelete = paths.map((p) => resolveWorkspacePath(workspaceRoot, p));
        } else if (pattern) {
          const matched = await fg(pattern, {
            cwd: workspaceRoot,
            ignore: ["**/node_modules/**", "**/.git/**"],
            onlyFiles: true,
            absolute: true,
          });
          filesToDelete = matched;
        }

        const results: DeleteResult[] = [];
        if (!dryRun && !confirmDelete) {
          const preview = filesToDelete.map((file) => ({
            path: path.relative(workspaceRoot, file),
            wouldDelete: true,
          }));
          return JSON.stringify(
            {
              results: preview,
              dryRun: true,
              warning:
                "Deletion requires explicit confirmation. Re-run with confirmDelete=true to execute.",
            },
            null,
            2
          );
        }

        for (const file of filesToDelete) {
          const relativePath = path.relative(workspaceRoot, file);
          if (dryRun) {
            results.push({ path: relativePath, wouldDelete: true });
          } else {
            try {
              const stat = await fs.stat(file);
              if (stat.isDirectory()) {
                await fs.rm(file, { recursive: true });
              } else {
                await fs.unlink(file);
              }
              results.push({ path: relativePath, deleted: true });
            } catch (error) {
              const err = error as Error;
              results.push({ path: relativePath, error: err.message });
            }
          }
        }

        notify("tool_end", { deleted: results.filter((r) => r.deleted).length });
        return JSON.stringify({ results, dryRun: !!dryRun }, null, 2);
      } catch (error) {
        const err = error as Error;
        notify("tool_error", { error: err.message });
        return `Error: ${err.message}`;
      }
    },
    {
      name: "file_delete",
      description: "Delete files by path or pattern. Supports dry run for preview.",
      schema: z.object({
        paths: z.array(z.string()).optional().describe("Specific file paths to delete"),
        pattern: z.string().optional().describe("Glob pattern to match files to delete"),
        dryRun: z.boolean().optional().describe("Preview deletions without actually deleting"),
        confirmDelete: z.boolean().optional().describe("Required true to execute actual deletion"),
      }),
    }
  );
}
