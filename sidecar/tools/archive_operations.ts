// @ts-nocheck
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import archiver from "archiver";
import unzipper from "unzipper";
import * as tar from "tar";
import { createGzip, createGunzip } from "node:zlib";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

function resolveWorkspacePath(workspaceRoot, targetPath) {
  const cleaned = targetPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const absolute = path.resolve(workspaceRoot, cleaned);
  const relative = path.relative(workspaceRoot, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path escapes workspace root.");
  }
  return absolute;
}

const ArchiveOperationSchema = z.object({
  operation: z.enum([
    "zip",
    "unzip",
    "tar",
    "untar",
    "gzip",
    "gunzip",
    "list",
  ]).describe("The operation to perform"),
  filePath: z.string().describe("Path to the archive or output file (relative to workspace)"),
  // Source for compression
  sourcePaths: z.array(z.string()).optional().describe("Files/folders to archive"),
  sourcePattern: z.string().optional().describe("Glob pattern for files to include"),
  // Extract destination
  extractTo: z.string().optional().describe("Directory to extract to"),
  // Options
  compressionLevel: z.number().optional().describe("Compression level 0-9"),
  password: z.string().optional().describe("Archive password (ZIP only)"),
  // Tar options
  tarGzip: z.boolean().optional().describe("Create .tar.gz instead of .tar"),
});

export function createArchiveOperationsTool({ workspaceRoot, requestId, emitStatus }) {
  const notify = (stage, detail) => {
    if (typeof emitStatus === "function") {
      emitStatus({ stage, tool: "archive_operations", detail, requestId });
    }
  };

  return tool(
    async (params) => {
      const {
        operation,
        filePath,
        sourcePaths,
        sourcePattern,
        extractTo,
        compressionLevel,
        password,
        tarGzip,
      } = params;

      notify("tool_start", { operation, filePath });

      try {
        const fullPath = resolveWorkspacePath(workspaceRoot, filePath);

        switch (operation) {
          case "zip": {
            if (!sourcePaths || sourcePaths.length === 0) {
              throw new Error("sourcePaths array is required for zip");
            }

            const output = fs.createWriteStream(fullPath);
            const archive = archiver("zip", {
              zlib: { level: compressionLevel ?? 9 },
            });

            const archivePromise = new Promise((resolve, reject) => {
              output.on("close", () => resolve(archive.pointer()));
              archive.on("error", reject);
            });

            archive.pipe(output);

            for (const sourcePath of sourcePaths) {
              const srcFullPath = resolveWorkspacePath(workspaceRoot, sourcePath);
              const stat = await fsp.stat(srcFullPath);

              if (stat.isDirectory()) {
                archive.directory(srcFullPath, path.basename(sourcePath));
              } else {
                archive.file(srcFullPath, { name: path.basename(sourcePath) });
              }
            }

            await archive.finalize();
            const bytes = await archivePromise;

            notify("tool_end", { operation });
            return JSON.stringify({
              operation: "zip",
              output: filePath,
              size: bytes,
              files: sourcePaths,
            }, null, 2);
          }

          case "unzip": {
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }

            const extractPath = extractTo
              ? resolveWorkspacePath(workspaceRoot, extractTo)
              : path.join(path.dirname(fullPath), path.basename(fullPath, ".zip"));

            await fsp.mkdir(extractPath, { recursive: true });

            const directory = await unzipper.Open.file(fullPath);
            const files = [];

            for (const file of directory.files) {
              const filePath = path.join(extractPath, file.path);

              // Prevent path traversal
              if (!filePath.startsWith(extractPath)) {
                continue;
              }

              if (file.type === "Directory") {
                await fsp.mkdir(filePath, { recursive: true });
              } else {
                await fsp.mkdir(path.dirname(filePath), { recursive: true });
                await pipeline(file.stream(), fs.createWriteStream(filePath));
                files.push(file.path);
              }
            }

            notify("tool_end", { operation });
            return JSON.stringify({
              operation: "unzip",
              source: filePath,
              extractedTo: path.relative(workspaceRoot, extractPath),
              fileCount: files.length,
              files: files.slice(0, 50),
            }, null, 2);
          }

          case "tar": {
            if (!sourcePaths || sourcePaths.length === 0) {
              throw new Error("sourcePaths array is required for tar");
            }

            const outputPath = tarGzip
              ? (fullPath.endsWith(".tar.gz") ? fullPath : `${fullPath}.gz`)
              : fullPath;

            const files = [];
            for (const sourcePath of sourcePaths) {
              const srcFullPath = resolveWorkspacePath(workspaceRoot, sourcePath);
              const stat = await fsp.stat(srcFullPath);
              files.push({
                path: srcFullPath,
                name: path.basename(sourcePath),
                isDir: stat.isDirectory(),
              });
            }

            await tar.create(
              {
                gzip: tarGzip || false,
                file: outputPath,
                cwd: workspaceRoot,
              },
              sourcePaths
            );

            const stat = await fsp.stat(outputPath);

            notify("tool_end", { operation });
            return JSON.stringify({
              operation: "tar",
              output: path.relative(workspaceRoot, outputPath),
              size: stat.size,
              compressed: tarGzip || false,
              files: sourcePaths,
            }, null, 2);
          }

          case "untar": {
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }

            const extractPath = extractTo
              ? resolveWorkspacePath(workspaceRoot, extractTo)
              : path.dirname(fullPath);

            await fsp.mkdir(extractPath, { recursive: true });

            await tar.extract({
              file: fullPath,
              cwd: extractPath,
            });

            notify("tool_end", { operation });
            return JSON.stringify({
              operation: "untar",
              source: filePath,
              extractedTo: path.relative(workspaceRoot, extractPath),
            }, null, 2);
          }

          case "gzip": {
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }

            const outputPath = `${fullPath}.gz`;
            const input = fs.createReadStream(fullPath);
            const output = fs.createWriteStream(outputPath);
            const gzip = createGzip({ level: compressionLevel ?? 9 });

            await pipeline(input, gzip, output);

            const inputStat = await fsp.stat(fullPath);
            const outputStat = await fsp.stat(outputPath);

            notify("tool_end", { operation });
            return JSON.stringify({
              operation: "gzip",
              source: filePath,
              output: path.relative(workspaceRoot, outputPath),
              originalSize: inputStat.size,
              compressedSize: outputStat.size,
              ratio: `${((1 - outputStat.size / inputStat.size) * 100).toFixed(1)}%`,
            }, null, 2);
          }

          case "gunzip": {
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }

            const outputPath = extractTo
              ? resolveWorkspacePath(workspaceRoot, extractTo)
              : fullPath.replace(/\.gz$/, "");

            const input = fs.createReadStream(fullPath);
            const output = fs.createWriteStream(outputPath);
            const gunzip = createGunzip();

            await pipeline(input, gunzip, output);

            const outputStat = await fsp.stat(outputPath);

            notify("tool_end", { operation });
            return JSON.stringify({
              operation: "gunzip",
              source: filePath,
              output: path.relative(workspaceRoot, outputPath),
              uncompressedSize: outputStat.size,
            }, null, 2);
          }

          case "list": {
            if (!fs.existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }

            const ext = path.extname(fullPath).toLowerCase();
            let files = [];

            if (ext === ".zip") {
              const directory = await unzipper.Open.file(fullPath);
              files = directory.files.map((f) => ({
                path: f.path,
                size: f.uncompressedSize,
                type: f.type,
              }));
            } else if (ext === ".tar" || ext === ".tgz" || fullPath.endsWith(".tar.gz")) {
              const entries = [];
              await tar.list({
                file: fullPath,
                onentry: (entry) => {
                  entries.push({
                    path: entry.path,
                    size: entry.size,
                    type: entry.type,
                  });
                },
              });
              files = entries;
            } else {
              throw new Error("Unsupported archive format for listing");
            }

            notify("tool_end", { operation });
            return JSON.stringify({
              operation: "list",
              archive: filePath,
              fileCount: files.length,
              files: files.slice(0, 100),
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
      name: "archive_operations",
      description: "Archive operations: create and extract ZIP files, create and extract TAR/TAR.GZ archives, GZIP/GUNZIP compression, and list archive contents.",
      schema: ArchiveOperationSchema,
    }
  );
}
