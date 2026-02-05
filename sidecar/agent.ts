// @ts-nocheck
import { ChatOpenAI } from "@langchain/openai";
import { CompositeBackend, FilesystemBackend, createDeepAgent, createSettings } from "deepagents";
import * as readline from "readline";
import fs from "node:fs";
import path from "node:path";
import {
  // Core utilities
  createCalculateExpressionTool,
  createGenerateUuidTool,
  createGetTimeTool,
  createGetTimezoneTool,
  createAgentBrowserTool,
  createRandomNumberTool,
  createRunNodeTool,
  // File management
  createOrganizeFolderTool,
  createFileSearchTool,
  createFileRenameTool,
  createFindDuplicatesTool,
  createFolderStructureTool,
  createFileCopyMoveTool,
  createFileDeleteTool,
  // Office documents
  createExcelOperationsTool,
  createWordOperationsTool,
  createPowerPointOperationsTool,
  // PDF
  createPDFOperationsTool,
  // Media
  createImageOperationsTool,
  createVideoOperationsTool,
  // Data analysis
  createDataAnalysisTool,
  // Archives
  createArchiveOperationsTool,
  // Web
  createWebOperationsTool,
  // Format conversion
  createFormatConversionTool,
  // Types
  StatusEmitter,
} from "./tools/index.js";
import { createFolderOrganizerSubagent } from "./subagents/folder_organizer.js";

const PROVIDER_BASE_URLS: Record<string, string> = {
  openrouter: "https://openrouter.ai/api/v1",
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  together: "https://api.together.xyz/v1",
  fireworks: "https://api.fireworks.ai/inference/v1",
  deepseek: "https://api.deepseek.com/v1",
  mistral: "https://api.mistral.ai/v1",
  perplexity: "https://api.perplexity.ai",
  xai: "https://api.x.ai/v1",
  moonshot: "https://api.moonshot.cn/v1",
};
const AGENT_NAME = "ohmycowork";

interface FileInfo {
  path: string;
  error?: string;
  content?: unknown;
}

interface ReadRawResult {
  content: string[];
  created_at: string;
  modified_at: string;
}

interface WriteResult {
  error: string | null;
  filesUpdate: unknown;
}

interface EditResult {
  error: string | null;
  filesUpdate: unknown;
  occurrences: number;
}

class NoopBackend {
  async lsInfo(): Promise<unknown[]> { return []; }
  async read(): Promise<string> { return "Error: Filesystem access is not available."; }
  async readRaw(): Promise<ReadRawResult> {
    return {
      content: ["Error: Filesystem access is not available."],
      created_at: "",
      modified_at: "",
    };
  }
  async grepRaw(): Promise<string> { return "Error: Filesystem access is not available."; }
  async globInfo(): Promise<unknown[]> { return []; }
  async write(): Promise<WriteResult> { return { error: "permission_denied", filesUpdate: null }; }
  async edit(): Promise<EditResult> { return { error: "permission_denied", filesUpdate: null, occurrences: 0 }; }
  async uploadFiles(files: [string, unknown][]): Promise<FileInfo[]> {
    return files.map(([path]) => ({ path, error: "permission_denied" }));
  }
  async downloadFiles(paths: string[]): Promise<FileInfo[]> {
    return paths.map((path) => ({ path, content: null, error: "permission_denied" }));
  }
}

interface AgentStatusPayload {
  requestId?: string | null;
  stage?: string;
  tool?: string | null;
  detail?: unknown;
}

function emitAgentStatus(payload?: AgentStatusPayload): void {
  console.log(
    JSON.stringify({
      event: "agent_status",
      requestId: payload?.requestId ?? null,
      stage: payload?.stage ?? "status",
      tool: payload?.tool ?? null,
      detail: payload?.detail ?? null,
    })
  );
}

function emitAssistantDelta(requestId: string | null | undefined, delta: string): void {
  if (!delta) return;
  console.log(
    JSON.stringify({
      event: "assistant_delta",
      requestId: requestId ?? null,
      delta,
    })
  );
}

function resolveBaseUrl(provider?: string, baseUrl?: string): string {
  if (typeof baseUrl === "string" && baseUrl.trim().length > 0) return baseUrl.trim();
  const key = typeof provider === "string" ? provider.toLowerCase() : "openrouter";
  return PROVIDER_BASE_URLS[key] ?? PROVIDER_BASE_URLS.openrouter;
}

function createChatModel(
  apiKey: string,
  model: string,
  provider?: string,
  baseUrl?: string,
  requestId?: string | null
): ChatOpenAI {
  return new ChatOpenAI({
    apiKey,
    model,
    streaming: true,
    configuration: {
      baseURL: resolveBaseUrl(provider, baseUrl),
    },
    callbacks: [
      {
        handleLLMNewToken(token: string) {
          emitAssistantDelta(requestId, token);
        },
      },
    ],
  });
}

interface ContentItem {
  text?: string;
  [key: string]: unknown;
}

function formatMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item: string | ContentItem) => {
        if (typeof item === "string") return item;
        if (typeof item === "object" && item && "text" in item) {
          return String(item.text ?? "");
        }
        return "";
      })
      .join("");
  }
  if (content == null) return "";
  return String(content);
}

interface SkillsConfig {
  backend: CompositeBackend | NoopBackend;
  skills: string[];
}

function buildSkillsConfig(workspacePath?: string): SkillsConfig {
  const settings = createSettings({
    startPath: workspacePath ?? process.cwd(),
  });
  const userSkillsDir = settings.ensureUserSkillsDir(AGENT_NAME);
  let projectSkillsDir = settings.ensureProjectSkillsDir();
  if (!projectSkillsDir && typeof workspacePath === "string" && workspacePath.trim()) {
    projectSkillsDir = path.join(workspacePath, ".deepagents", "skills");
    fs.mkdirSync(projectSkillsDir, { recursive: true });
  }

  const routes: Record<string, FilesystemBackend> = {};
  if (userSkillsDir) {
    routes["/skills/user/"] = new FilesystemBackend({
      rootDir: userSkillsDir,
      virtualMode: true,
    });
  }
  if (projectSkillsDir) {
    routes["/skills/project/"] = new FilesystemBackend({
      rootDir: projectSkillsDir,
      virtualMode: true,
    });
  }

  const routeKeys = Object.keys(routes);
  let defaultBackend: FilesystemBackend | NoopBackend;
  try {
    defaultBackend = new FilesystemBackend({
      rootDir: workspacePath ?? process.cwd(),
      virtualMode: true,
    });
  } catch {
    defaultBackend = new NoopBackend();
  }
  const backend = new CompositeBackend(defaultBackend, routes);

  return {
    backend,
    skills: routeKeys,
  };
}

interface Message {
  role: string;
  content: unknown;
  _getType?: () => string;
  tool_calls?: Array<{ name: string; args: unknown }>;
}

interface SendMessageRequest {
  provider?: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
  messages: Message[];
  workspacePath?: string;
  requestId?: string;
}

async function sendMessage(request: SendMessageRequest): Promise<string> {
  const { provider, apiKey, model, baseUrl, messages, workspacePath, requestId } = request;
  const workspaceRoot = typeof workspacePath === "string" && workspacePath.trim().length > 0
    ? workspacePath
    : undefined;

  const chatModel = createChatModel(apiKey, model, provider, baseUrl, requestId ?? null);

  const emitStatus: StatusEmitter = (payload) => emitAgentStatus({ ...payload, requestId: payload?.requestId ?? requestId ?? null });

  // Create tools array
  const tools = [
    // Core utilities
    createGetTimeTool({ requestId, emitStatus }),
    createGetTimezoneTool({ requestId, emitStatus }),
    createRandomNumberTool({ requestId, emitStatus }),
    createGenerateUuidTool({ requestId, emitStatus }),
    createCalculateExpressionTool({ requestId, emitStatus }),
    createRunNodeTool({ requestId, emitStatus }),
    createAgentBrowserTool({ requestId, emitStatus }),

    // File management
    createOrganizeFolderTool({ workspaceRoot, requestId, emitStatus }),
    createFileSearchTool({ workspaceRoot, requestId, emitStatus }),
    createFileRenameTool({ workspaceRoot, requestId, emitStatus }),
    createFindDuplicatesTool({ workspaceRoot, requestId, emitStatus }),
    createFolderStructureTool({ workspaceRoot, requestId, emitStatus }),
    createFileCopyMoveTool({ workspaceRoot, requestId, emitStatus }),
    createFileDeleteTool({ workspaceRoot, requestId, emitStatus }),

    // Office documents
    createExcelOperationsTool({ workspaceRoot, requestId, emitStatus }),
    createWordOperationsTool({ workspaceRoot, requestId, emitStatus }),
    createPowerPointOperationsTool({ workspaceRoot, requestId, emitStatus }),

    // PDF operations
    createPDFOperationsTool({ workspaceRoot, requestId, emitStatus }),

    // Media processing
    createImageOperationsTool({ workspaceRoot, requestId, emitStatus }),
    createVideoOperationsTool({ workspaceRoot, requestId, emitStatus }),

    // Data analysis
    createDataAnalysisTool({ workspaceRoot, requestId, emitStatus }),

    // Archive operations
    createArchiveOperationsTool({ workspaceRoot, requestId, emitStatus }),

    // Web operations
    createWebOperationsTool({ workspaceRoot, requestId, emitStatus }),

    // Format conversion
    createFormatConversionTool({ workspaceRoot, requestId, emitStatus }),
  ];

  let systemPrompt = `You are an expert assistant with powerful automation capabilities. You have access to a comprehensive set of tools for:

## Core Utilities
- \`get_time\`, \`get_timezone\`: Get current time and timezone info
- \`random_number\`, \`generate_uuid\`: Generate random values
- \`calculate_expression\`: Mathematical calculations
- \`run_node\`: Execute Node.js code
- \`agent_browser\`: Browser automation via Playwright

## File Management
- \`file_search\`: Search files using glob patterns
- \`file_rename\`: Batch rename files with patterns
- \`find_duplicates\`: Find and optionally delete duplicate files
- \`create_folders\`: Create folder structures
- \`file_copy_move\`: Copy or move files
- \`file_delete\`: Delete files or folders
- \`organize_folder\`: Auto-organize files into category folders

## Office Documents
- \`excel_operations\`: Create, read, analyze Excel files, CSV conversion, formulas, pivot tables
- \`word_operations\`: Create Word documents, templates, Markdown conversion, headers/footers
- \`powerpoint_operations\`: Create presentations with slides, charts, images, shapes

## PDF Operations
- \`pdf_operations\`: Create, merge, split, extract text, add watermarks, page numbers, rotate

## Media Processing
- \`image_operations\`: Resize, crop, convert, compress, blur, sharpen, watermark images
- \`video_operations\`: Trim, merge, compress, convert, add subtitles, extract frames, create GIFs

## Data Analysis
- \`data_analysis\`: Read CSV, statistics, correlations, group by, filter, sort, pivot tables, outlier detection

## Archives
- \`archive_operations\`: ZIP/TAR/GZIP compression and extraction

## Web Operations
- \`web_operations\`: HTTP requests, HTML parsing, RSS feeds, file downloads, JSON APIs

## Format Conversion
- \`format_conversion\`: Convert between formats (Markdown/HTML/DOCX, JSON/CSV/YAML, Base64)

## Subagents
- folder-organizer: Specialized agent for intelligent folder organization

When using file tools, always use workspace-relative paths (e.g., "/file.txt", not absolute paths).
`;

  // Add workspace context
  if (workspaceRoot) {
    systemPrompt += `
## Workspace
The user's workspace is mounted at virtual path "/". When using filesystem tools, always use paths relative to "/" - NOT absolute system paths.
- To list the workspace root: use path "/"
- To read a file: use path "/filename.txt", NOT "/Users/.../filename.txt"
- The actual system path "${workspaceRoot}" is mapped to virtual path "/"

IMPORTANT: Never use absolute system paths like "/Users/..." with filesystem tools. Always use virtual paths starting with "/".`;
  } else {
    systemPrompt += `
## Workspace
No workspace folder is currently selected.
- For any file/folder/document/media operation, first ask the user to provide or select a workspace folder.
- Do not call filesystem tools until a workspace is provided.`;
  }

  const { backend, skills } = buildSkillsConfig(workspaceRoot);
  const subagents = [
    createFolderOrganizerSubagent({
      model: chatModel,
      workspaceRoot,
      requestId,
      emitStatus,
    }),
  ];

  const agent = createDeepAgent({
    model: chatModel,
    backend,
    tools,
    skills: skills.length > 0 ? skills : undefined,
    subagents,
    name: AGENT_NAME,
    systemPrompt,
  });

  const runtimeMessages = [...messages];

  console.log(
    JSON.stringify({
      event: "agent_status",
      requestId: requestId ?? null,
      stage: "processing",
      tool: null,
      detail: null,
    })
  );
  const result = await agent.invoke({ messages: runtimeMessages });
  const responseMessages = result.messages as Message[];

  // Debug: log message types and tool calls
  console.error(JSON.stringify({
    event: "debug_messages",
    messages: responseMessages?.map((m: Message, i: number) => ({
      index: i,
      type: (m as unknown as { constructor?: { name?: string } }).constructor?.name || typeof m,
      role: m._getType?.() || m.role,
      hasToolCalls: !!(m.tool_calls?.length),
      toolCalls: m.tool_calls?.map(tc => ({ name: tc.name, args: tc.args })),
      toolContent: m._getType?.() === "tool" ? String(m.content).slice?.(0, 500) : undefined,
    }))
  }));

  const lastAssistantMessage = [...(responseMessages ?? [])].reverse().find((m) => {
    const role = m._getType?.() || m.role;
    return role === "assistant" || role === "ai";
  });
  const fallbackMessage = responseMessages?.[responseMessages.length - 1];
  const finalText = formatMessageContent((lastAssistantMessage ?? fallbackMessage)?.content) || "No response from model.";
  console.error(`[sidecar stderr] model_response ${JSON.stringify(finalText)}`);
  return finalText;
}

interface JsonRpcRequest {
  id: string | number | null;
  method: string;
  params: SendMessageRequest;
}

interface JsonRpcError {
  code: number;
  message: string;
}

interface JsonRpcResponse {
  id: string | number | null;
  result?: string;
  error?: JsonRpcError;
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;

  const anyErr = err as any;
  const providerMessage =
    anyErr?.response?.data?.error?.message ??
    anyErr?.response?.data?.message ??
    anyErr?.error?.message ??
    anyErr?.message;
  const status = anyErr?.response?.status ?? anyErr?.status;

  if (providerMessage && status) return `${providerMessage} (status ${status})`;
  if (providerMessage) return String(providerMessage);

  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

// JSON-RPC style communication via stdin/stdout
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", async (line: string) => {
  try {
    const request: JsonRpcRequest = JSON.parse(line);
    const { id, method, params } = request;

    let result: string | undefined;
    let error: JsonRpcError | null = null;

    try {
      if (method === "sendMessage") {
        result = await sendMessage(params);
      } else if (method === "ping") {
        result = "pong";
      } else {
        error = { code: -32601, message: "Method not found" };
      }
    } catch (err) {
      const message = extractErrorMessage(err);
      console.error(
        JSON.stringify({
          event: "rpc_error",
          method,
          message,
          raw: err,
        })
      );
      error = { code: -32000, message };
    }

    const response: JsonRpcResponse = error
      ? { id, error }
      : { id, result };

    console.log(JSON.stringify(response));
  } catch {
    console.log(JSON.stringify({ id: null, error: { code: -32700, message: "Parse error" } }));
  }
});

// Signal ready
console.log(JSON.stringify({ ready: true }));
