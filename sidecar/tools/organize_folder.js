import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";

// Basic file-type categories for deterministic organization.
const CATEGORY_RULES = [
  { name: "Images", exts: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff", ".svg", ".heic", ".ico"] },
  { name: "Video", exts: [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"] },
  { name: "Audio", exts: [".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a"] },
  { name: "Archives", exts: [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".tgz"] },
  { name: "Documents", exts: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".md", ".rtf", ".csv"] },
  { name: "Code", exts: [".js", ".ts", ".jsx", ".tsx", ".py", ".rb", ".go", ".rs", ".java", ".kt", ".swift", ".c", ".h", ".cpp", ".hpp", ".cs", ".php", ".sh", ".bash", ".zsh", ".ps1", ".sql", ".html", ".css", ".scss", ".json", ".yaml", ".yml", ".toml"] },
  { name: "Data", exts: [".parquet", ".avro", ".feather", ".db", ".sqlite", ".sqlite3"] },
  { name: "Design", exts: [".fig", ".sketch", ".xd", ".ai", ".psd"] },
  { name: "Fonts", exts: [".ttf", ".otf", ".woff", ".woff2"] },
];

const SKIP_DIRS = new Set(["node_modules", ".git", ".DS_Store"]);

function resolveWorkspacePath(workspaceRoot, targetPath) {
  // Ensure the requested path stays inside the workspace root.
  const cleaned = targetPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const absolute = path.resolve(workspaceRoot, cleaned);
  const relative = path.relative(workspaceRoot, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path escapes workspace root.");
  }
  return absolute;
}

function classifyFile(fileName) {
  if (fileName.startsWith(".")) return "Config";
  const ext = path.extname(fileName).toLowerCase();
  const match = CATEGORY_RULES.find((rule) => rule.exts.includes(ext));
  return match ? match.name : "Other";
}

async function ensureUniquePath(targetPath) {
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath, path.extname(targetPath));
  const ext = path.extname(targetPath);
  let candidate = targetPath;
  let counter = 1;
  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(dir, `${base} (${counter})${ext}`);
      counter += 1;
    } catch {
      return candidate;
    }
  }
}

export function createOrganizeFolderTool({ workspaceRoot, requestId, emitStatus }) {
  const notify = (stage, detail) => {
    if (typeof emitStatus === "function") {
      emitStatus({ stage, tool: "organize_folder", detail, requestId });
    }
  };

  return tool(
    async ({ path: folderPath, includeNested = false }) => {
      notify("tool_start", { path: folderPath, includeNested });
      const absoluteFolder = resolveWorkspacePath(workspaceRoot, folderPath);
      let entries;
      try {
        entries = await fs.readdir(absoluteFolder, { withFileTypes: true });
      } catch (error) {
        if (error?.code === "EACCES" || error?.code === "EPERM") {
          notify("permission_error", { path: folderPath });
        }
        throw error;
      }

      const moved = [];
      const skipped = [];
      const errors = [];

      const processEntry = async (entryPath, entryName) => {
        const category = classifyFile(entryName);
        const targetDir = path.join(absoluteFolder, category);
        await fs.mkdir(targetDir, { recursive: true });
        const destination = await ensureUniquePath(path.join(targetDir, entryName));
        try {
          await fs.rename(entryPath, destination);
          moved.push({ from: entryPath, to: destination });
        } catch (error) {
          if (error?.code === "EACCES" || error?.code === "EPERM") {
            notify("permission_error", { path: entryPath });
          }
          errors.push({ path: entryPath, message: error?.message || String(error) });
        }
      };

      for (const entry of entries) {
        if (entry.name.startsWith(".") && entry.name !== ".env") {
          if (entry.isDirectory()) {
            skipped.push(entry.name);
          }
          continue;
        }

        const absoluteEntry = path.join(absoluteFolder, entry.name);

        if (entry.isDirectory()) {
          if (SKIP_DIRS.has(entry.name)) {
            skipped.push(entry.name);
            continue;
          }

          if (includeNested) {
            const nestedEntries = await fs.readdir(absoluteEntry, { withFileTypes: true });
            for (const nested of nestedEntries) {
              if (nested.isFile()) {
                await processEntry(path.join(absoluteEntry, nested.name), nested.name);
              }
            }
          } else {
            skipped.push(entry.name);
          }
          continue;
        }

        if (entry.isFile()) {
          await processEntry(absoluteEntry, entry.name);
        }
      }

      const result = {
        path: folderPath,
        moved,
        skipped,
        errors,
      };
      notify("tool_end", { moved: moved.length, errors: errors.length });
      return result;
    },
    {
      name: "organize_folder",
      description:
        "Organize a workspace folder into category subfolders (Documents, Images, Code, etc.). Paths are workspace-relative.",
      schema: z.object({
        path: z.string().describe("Workspace-relative folder path to organize (e.g., '/', 'Downloads')"),
        includeNested: z.boolean().optional().default(false).describe("Also reorganize files inside immediate subfolders"),
      }),
    }
  );
}
