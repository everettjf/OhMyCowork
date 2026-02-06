import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { ToolContext, createNotifier, resolveWorkspacePath } from "./types.js";

interface CategoryRule {
  name: string;
  exts: string[];
}

// Best-practice file-type categories for deterministic organization.
const CATEGORY_RULES: CategoryRule[] = [
  { name: "Screenshots", exts: [".png", ".jpg", ".jpeg", ".heic", ".webp"] },
  { name: "Images", exts: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff", ".svg", ".heic", ".ico"] },
  { name: "Video", exts: [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"] },
  { name: "Audio", exts: [".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a"] },
  { name: "PDFs", exts: [".pdf"] },
  { name: "Spreadsheets", exts: [".xls", ".xlsx", ".csv", ".tsv", ".ods"] },
  { name: "Presentations", exts: [".ppt", ".pptx", ".key", ".odp"] },
  { name: "Documents", exts: [".doc", ".docx", ".rtf", ".odt"] },
  { name: "Notes", exts: [".txt", ".md", ".markdown", ".org"] },
  { name: "Archives", exts: [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".tgz"] },
  { name: "Installers", exts: [".dmg", ".pkg", ".msi", ".exe", ".appimage", ".deb", ".rpm"] },
  { name: "Code", exts: [".js", ".ts", ".jsx", ".tsx", ".py", ".rb", ".go", ".rs", ".java", ".kt", ".swift", ".c", ".h", ".cpp", ".hpp", ".cs", ".php", ".sh", ".bash", ".zsh", ".ps1", ".sql", ".html", ".css", ".scss", ".json", ".yaml", ".yml", ".toml"] },
  { name: "Data", exts: [".parquet", ".avro", ".feather", ".db", ".sqlite", ".sqlite3"] },
  { name: "Design", exts: [".fig", ".sketch", ".xd", ".ai", ".psd"] },
  { name: "Fonts", exts: [".ttf", ".otf", ".woff", ".woff2"] },
];

const SKIP_DIRS = new Set(["node_modules", ".git", ".DS_Store"]);
const CATEGORY_DIRS = new Set(CATEGORY_RULES.map((rule) => rule.name));
const DATE_BUCKET_CATEGORIES = new Set(["Screenshots", "Images", "Video", "Audio"]);
const SCREENSHOT_PATTERNS = [
  /screenshot/i,
  /screen\s*shot/i,
  /屏幕截图/,
  /屏幕快照/,
  /截屏/,
];

interface MoveRecord {
  from: string;
  to: string;
}

interface RenameRecord {
  from: string;
  to: string;
}

interface DedupRecord {
  from: string;
  kept: string;
  reason: "hash-match";
}

interface ErrorRecord {
  path: string;
  message: string;
}

function isScreenshot(fileName: string, ext: string): boolean {
  if (![".png", ".jpg", ".jpeg", ".heic", ".webp"].includes(ext)) return false;
  return SCREENSHOT_PATTERNS.some((pattern) => pattern.test(fileName));
}

function classifyFile(fileName: string): string {
  if (fileName.startsWith(".")) return "Config";
  const ext = path.extname(fileName).toLowerCase();
  if (isScreenshot(fileName, ext)) return "Screenshots";
  const match = CATEGORY_RULES.find((rule) => rule.exts.includes(ext));
  return match ? match.name : "Other";
}

async function ensureUniquePath(targetPath: string): Promise<string> {
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath, path.extname(targetPath));
  const ext = path.extname(targetPath);
  let candidate = targetPath;
  let counter = 1;
  while (true) {
    try {
      await fs.access(candidate);
      if (path.resolve(candidate) === path.resolve(targetPath)) {
        return candidate;
      }
      candidate = path.join(dir, `${base} (${counter})${ext}`);
      counter += 1;
    } catch {
      return candidate;
    }
  }
}

const pad2 = (value: number) => String(value).padStart(2, "0");

async function getDateBucket(filePath: string): Promise<string> {
  try {
    const stats = await fs.stat(filePath);
    const date = stats.mtime ?? stats.birthtime ?? new Date();
    const year = date.getFullYear();
    const month = pad2(date.getMonth() + 1);
    return path.join(String(year), month);
  } catch {
    return "Unknown";
  }
}

async function isDirEmpty(dirPath: string): Promise<boolean> {
  try {
    const items = await fs.readdir(dirPath);
    return items.length === 0;
  } catch {
    return false;
  }
}

function shouldSkipDirName(dirName: string): boolean {
  if (SKIP_DIRS.has(dirName)) return true;
  if (CATEGORY_DIRS.has(dirName)) return true;
  if (dirName.startsWith(".")) return true;
  return false;
}

const DUPLICATE_SUFFIX = /(.*)\s\((\d+)\)(\.[^./\\]+)?$/;

async function normalizeDuplicateNames(
  root: string,
  toWorkspaceRelative: (absolutePath: string) => string,
  errors: ErrorRecord[]
): Promise<RenameRecord[]> {
  const renamed: RenameRecord[] = [];

  const walk = async (dirPath: string) => {
    let items: fs.Dirent[] = [];
    try {
      items = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const item of items) {
      if (item.isDirectory()) {
        if (shouldSkipDirName(item.name)) continue;
        await walk(path.join(dirPath, item.name));
        continue;
      }
      if (!item.isFile()) continue;

      const absolutePath = path.join(dirPath, item.name);
      const match = item.name.match(DUPLICATE_SUFFIX);
      if (!match) continue;

      const base = match[1];
      const ext = match[3] ?? "";
      const cleanName = `${base}${ext}`;
      const cleanPath = path.join(dirPath, cleanName);

      try {
        await fs.access(cleanPath);
        // Base file exists, keep the numbered duplicate.
        continue;
      } catch {
        // Base doesn't exist, safe to rename.
      }

      try {
        const destination = await ensureUniquePath(cleanPath);
        if (path.resolve(destination) === path.resolve(absolutePath)) continue;
        await fs.rename(absolutePath, destination);
        renamed.push({ from: toWorkspaceRelative(absolutePath), to: toWorkspaceRelative(destination) });
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        errors.push({ path: absolutePath, message: err?.message || String(error) });
      }
    }
  };

  await walk(root);
  return renamed;
}

async function hashFile(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  return crypto.createHash("md5").update(data).digest("hex");
}

async function dedupeByHash(
  root: string,
  toWorkspaceRelative: (absolutePath: string) => string,
  errors: ErrorRecord[]
): Promise<DedupRecord[]> {
  const removed: DedupRecord[] = [];
  const byName = new Map<string, string>();

  const walk = async (dirPath: string) => {
    let items: fs.Dirent[] = [];
    try {
      items = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const item of items) {
      const absolutePath = path.join(dirPath, item.name);
      if (item.isDirectory()) {
        if (shouldSkipDirName(item.name)) continue;
        await walk(absolutePath);
        continue;
      }
      if (!item.isFile()) continue;

      const existing = byName.get(item.name);
      if (!existing) {
        byName.set(item.name, absolutePath);
        continue;
      }
      try {
        const [hashA, hashB] = await Promise.all([hashFile(existing), hashFile(absolutePath)]);
        if (hashA === hashB) {
          await fs.unlink(absolutePath);
          removed.push({
            from: toWorkspaceRelative(absolutePath),
            kept: toWorkspaceRelative(existing),
            reason: "hash-match",
          });
        }
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        errors.push({ path: absolutePath, message: err?.message || String(error) });
      }
    }
  };

  await walk(root);
  return removed;
}

export function createOrganizeFolderTool({ workspaceRoot, requestId, emitStatus }: ToolContext) {
  const notify = createNotifier("organize_folder", emitStatus, requestId);

  return tool(
    async ({ path: folderPath, includeNested = false }: { path: string; includeNested?: boolean }) => {
      notify("tool_start", { path: folderPath, includeNested });

      if (!workspaceRoot) {
        throw new Error("workspaceRoot is required");
      }

      const absoluteFolder = resolveWorkspacePath(workspaceRoot, folderPath);
      let entries;
      try {
        entries = await fs.readdir(absoluteFolder, { withFileTypes: true });
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err?.code === "EACCES" || err?.code === "EPERM") {
          notify("tool_error", { path: folderPath });
        }
        throw error;
      }

      const moved: MoveRecord[] = [];
      const renamed: RenameRecord[] = [];
      const skipped: string[] = [];
      const errors: ErrorRecord[] = [];
      const deletedEmptyFolders: string[] = [];
      const deduped: DedupRecord[] = [];
      const touchedDirs = new Set<string>();

      const toWorkspaceRelative = (absolutePath: string) => {
        const relative = path.relative(workspaceRoot, absolutePath);
        return relative ? `/${relative}` : "/";
      };

      const processEntry = async (entryPath: string, entryName: string) => {
        const category = classifyFile(entryName);
        let targetDir = path.join(absoluteFolder, category);
        if (DATE_BUCKET_CATEGORIES.has(category)) {
          const bucket = await getDateBucket(entryPath);
          targetDir = path.join(targetDir, bucket);
        }
        await fs.mkdir(targetDir, { recursive: true });
        const destination = await ensureUniquePath(path.join(targetDir, entryName));
        try {
          if (entryPath === destination) return;
          await fs.rename(entryPath, destination);
          moved.push({ from: toWorkspaceRelative(entryPath), to: toWorkspaceRelative(destination) });
          touchedDirs.add(path.dirname(entryPath));
        } catch (error) {
          const err = error as NodeJS.ErrnoException;
          if (err?.code === "EACCES" || err?.code === "EPERM") {
            notify("tool_error", { path: entryPath });
          }
          errors.push({ path: entryPath, message: err?.message || String(error) });
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
          if (shouldSkipDirName(entry.name)) {
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

      const cleanupTouchedDirs = async () => {
        const candidates = Array.from(touchedDirs).sort((a, b) => b.length - a.length);
        for (const dir of candidates) {
          let current = dir;
          while (current.startsWith(absoluteFolder) && current !== absoluteFolder) {
            const base = path.basename(current);
            if (shouldSkipDirName(base)) break;
            const empty = await isDirEmpty(current);
            if (!empty) break;
            try {
              await fs.rmdir(current);
              deletedEmptyFolders.push(toWorkspaceRelative(current));
            } catch {
              break;
            }
            current = path.dirname(current);
          }
        }
      };

      const cleanupAllEmptyDirs = async (dirPath: string) => {
        let items: fs.Dirent[] = [];
        try {
          items = await fs.readdir(dirPath, { withFileTypes: true });
        } catch {
          return;
        }

        for (const item of items) {
          if (!item.isDirectory()) continue;
          const childPath = path.join(dirPath, item.name);
          if (shouldSkipDirName(item.name)) continue;
          await cleanupAllEmptyDirs(childPath);
        }

        if (dirPath !== absoluteFolder) {
          const base = path.basename(dirPath);
          if (!shouldSkipDirName(base)) {
            const empty = await isDirEmpty(dirPath);
            if (empty) {
              try {
                await fs.rmdir(dirPath);
                deletedEmptyFolders.push(toWorkspaceRelative(dirPath));
              } catch {
                // ignore
              }
            }
          }
        }
      };

      const renames = await normalizeDuplicateNames(absoluteFolder, toWorkspaceRelative, errors);
      renamed.push(...renames);
      const dedupes = await dedupeByHash(absoluteFolder, toWorkspaceRelative, errors);
      deduped.push(...dedupes);
      await cleanupTouchedDirs();
      await cleanupAllEmptyDirs(absoluteFolder);

      const result = {
        path: folderPath,
        moved,
        renamed,
        deduped,
        deletedEmptyFolders,
        skipped,
        errors,
        summary: {
          moved: moved.length,
          renamed: renamed.length,
          deduped: deduped.length,
          deletedEmptyFolders: deletedEmptyFolders.length,
          skipped: skipped.length,
          errors: errors.length,
        },
      };
      notify("tool_end", result.summary);
      return result;
    },
    {
      name: "organize_folder",
      description:
        "Organize a workspace folder into best-practice category subfolders with reports of moved files and deleted empty folders. Paths are workspace-relative.",
      schema: z.object({
        path: z.string().describe("Workspace-relative folder path to organize (e.g., '/', 'Downloads')"),
        includeNested: z.boolean().optional().default(false).describe("Also reorganize files inside immediate subfolders"),
      }),
    }
  );
}
