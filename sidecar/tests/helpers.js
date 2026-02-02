import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Create a temporary workspace directory for testing
 */
export async function createTestWorkspace() {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "ohmycowork-test-"));
  return workspaceRoot;
}

/**
 * Clean up a test workspace
 */
export async function cleanupTestWorkspace(workspaceRoot) {
  try {
    await rm(workspaceRoot, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors
  }
}

/**
 * Create a mock emitStatus function that records all status events
 */
export function createMockEmitStatus() {
  const events = [];
  const emitStatus = (event) => {
    events.push(event);
  };
  return { emitStatus, events };
}

/**
 * Create test files in the workspace
 */
export async function createTestFiles(workspaceRoot, files) {
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(workspaceRoot, relativePath);
    const dir = join(fullPath, "..");
    await mkdir(dir, { recursive: true });
    if (typeof content === "string") {
      await writeFile(fullPath, content, "utf-8");
    } else {
      await writeFile(fullPath, content);
    }
  }
}

/**
 * Read file content from workspace
 */
export async function readTestFile(workspaceRoot, relativePath) {
  const fullPath = join(workspaceRoot, relativePath);
  return await readFile(fullPath, "utf-8");
}

/**
 * Check if file exists in workspace
 */
export async function fileExists(workspaceRoot, relativePath) {
  try {
    const fullPath = join(workspaceRoot, relativePath);
    await stat(fullPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file stats from workspace
 */
export async function getFileStats(workspaceRoot, relativePath) {
  const fullPath = join(workspaceRoot, relativePath);
  return await stat(fullPath);
}

/**
 * Sample CSV content for testing
 */
export const SAMPLE_CSV = `name,age,city,salary
Alice,30,New York,75000
Bob,25,Los Angeles,65000
Charlie,35,Chicago,85000
Diana,28,Houston,70000
Eve,32,Phoenix,80000`;

/**
 * Sample JSON content for testing
 */
export const SAMPLE_JSON = JSON.stringify([
  { name: "Alice", age: 30, city: "New York" },
  { name: "Bob", age: 25, city: "Los Angeles" },
  { name: "Charlie", age: 35, city: "Chicago" },
], null, 2);

/**
 * Sample Markdown content for testing
 */
export const SAMPLE_MARKDOWN = `# Test Document

This is a **test** document with _formatting_.

## Section 1

- Item 1
- Item 2
- Item 3

## Section 2

Some paragraph text here.

\`\`\`javascript
console.log("Hello World");
\`\`\`
`;

/**
 * Sample HTML content for testing
 */
export const SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Test Page</title>
</head>
<body>
  <h1>Test Heading</h1>
  <p>This is a test paragraph.</p>
  <a href="https://example.com">Example Link</a>
  <ul>
    <li>Item 1</li>
    <li>Item 2</li>
  </ul>
</body>
</html>`;
