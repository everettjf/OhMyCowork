import { ChatOpenAI } from "@langchain/openai";
import { CompositeBackend, FilesystemBackend, createDeepAgent, createSettings } from "deepagents";
import * as readline from "readline";
import fs from "node:fs";
import path from "node:path";
import {
  createCalculateExpressionTool,
  createGenerateUuidTool,
  createGetTimeTool,
  createGetTimezoneTool,
  createInternetSearchTool,
  createRandomNumberTool,
  createRunNodeTool,
} from "./tools/index.js";
import { createFolderOrganizerSubagent } from "./subagents/folder_organizer.js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const AGENT_NAME = "ohmycowork";

class NoopBackend {
  async lsInfo() { return []; }
  async read() { return "Error: Filesystem access is not available."; }
  async readRaw() {
    return {
      content: ["Error: Filesystem access is not available."],
      created_at: "",
      modified_at: "",
    };
  }
  async grepRaw() { return "Error: Filesystem access is not available."; }
  async globInfo() { return []; }
  async write() { return { error: "permission_denied", filesUpdate: null }; }
  async edit() { return { error: "permission_denied", filesUpdate: null, occurrences: 0 }; }
  async uploadFiles(files) { return files.map(([path]) => ({ path, error: "permission_denied" })); }
  async downloadFiles(paths) { return paths.map((path) => ({ path, content: null, error: "permission_denied" })); }
}

function emitAgentStatus(payload) {
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

function createChatModel(apiKey, model) {
  return new ChatOpenAI({
    apiKey,
    model,
    configuration: {
      baseURL: OPENROUTER_BASE_URL,
      // defaultHeaders: {
      //   "HTTP-Referer": "https://ohmyco.work",
      //   "X-Title": "Oh My Cowork",
      // },
    },
  });
}

function formatMessageContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
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

function buildSkillsConfig(workspacePath) {
  // Skills use DeepAgents' standard user/project paths with a workspace fallback.
  const settings = createSettings({
    startPath: workspacePath ?? process.cwd(),
  });
  const userSkillsDir = settings.ensureUserSkillsDir(AGENT_NAME);
  let projectSkillsDir = settings.ensureProjectSkillsDir();
  if (!projectSkillsDir && typeof workspacePath === "string" && workspacePath.trim()) {
    projectSkillsDir = path.join(workspacePath, ".deepagents", "skills");
    fs.mkdirSync(projectSkillsDir, { recursive: true });
  }

  const routes = {};
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
  let defaultBackend;
  try {
    // Workspace-only filesystem backend for safe file access.
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

async function sendMessage(request) {
  const { apiKey, model, messages, workspacePath, tavilyApiKey, requestId } = request;
  const workspaceRoot = workspacePath ?? process.cwd();

  const chatModel = createChatModel(apiKey, model);

  const normalizedTavilyKey = typeof tavilyApiKey === "string" ? tavilyApiKey.trim() : "";
  const hasTavilyKey = normalizedTavilyKey.length > 0;
  const tavilyKeyPreview = hasTavilyKey
    ? `${normalizedTavilyKey.slice(0, 4)}...${normalizedTavilyKey.slice(-4)}`
    : "none";
  const hadWhitespace = typeof tavilyApiKey === "string" && normalizedTavilyKey !== tavilyApiKey;
  console.error(
    JSON.stringify({
      event: "tavily_key_status",
      hasTavilyKey,
      tavilyKeyPreview,
      hadWhitespace,
    })
  );

  const emitStatus = (payload) => emitAgentStatus({ ...payload, requestId: payload?.requestId ?? requestId ?? null });

  // Create tools array
  const tools = [
    createGetTimeTool({ requestId, emitStatus }),
    createGetTimezoneTool({ requestId, emitStatus }),
    createRandomNumberTool({ requestId, emitStatus }),
    createGenerateUuidTool({ requestId, emitStatus }),
    createCalculateExpressionTool({ requestId, emitStatus }),
    createRunNodeTool({ requestId, emitStatus }),
  ];
  if (hasTavilyKey) {
    tools.push(
      createInternetSearchTool({
        tavilyApiKey: normalizedTavilyKey,
        requestId,
        emitStatus,
      })
    );
  }


  let systemPrompt = `You are an expert researcher and coworker assistant. Your job is to conduct thorough research and then write a polished report.

You have access to an internet search tool as your primary means of gathering information.

## \`internet_search\`

Use this to run an internet search for a given query. You can specify the max number of results to return, the topic, and whether raw content should be included.

## Subagents

- folder-organizer: organize a folder into clean, category-based subfolders.
`;

  // context
  if (workspacePath) {
    systemPrompt += `

## Workspace

The user's workspace is mounted at virtual path "/". When using filesystem tools (ls, read_file, write_file, etc.), always use paths relative to "/" - NOT absolute system paths.

- To list the workspace root: use path "/"
- To read a file: use path "/filename.txt", NOT "/Users/.../filename.txt"
- The actual system path "${workspacePath}" is mapped to virtual path "/"

IMPORTANT: Never use absolute system paths like "/Users/..." with filesystem tools. Always use virtual paths starting with "/".`;
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
  const responseMessages = result.messages;

  // Debug: 打印所有消息类型、tool calls 和 tool 返回内容
  console.error(JSON.stringify({
    event: "debug_messages",
    messages: responseMessages?.map((m, i) => ({
      index: i,
      type: m.constructor?.name || typeof m,
      role: m._getType?.() || m.role,
      hasToolCalls: !!(m.tool_calls?.length),
      toolCalls: m.tool_calls?.map(tc => ({ name: tc.name, args: tc.args })),
      // 如果是 ToolMessage，显示内容
      toolContent: m._getType?.() === "tool" ? m.content?.slice?.(0, 500) : undefined,
    }))
  }));

  const lastMessage = responseMessages?.[responseMessages.length - 1];

  return formatMessageContent(lastMessage?.content) || "No response from model.";
}

// JSON-RPC style communication via stdin/stdout
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", async (line) => {
  try {
    const request = JSON.parse(line);
    const { id, method, params } = request;

    let result;
    let error = null;

    try {
      if (method === "sendMessage") {
        result = await sendMessage(params);
      } else if (method === "ping") {
        result = "pong";
      } else {
        error = { code: -32601, message: "Method not found" };
      }
    } catch (err) {
      error = { code: -32000, message: err.message || "Unknown error" };
    }

    const response = error
      ? { id, error }
      : { id, result };

    console.log(JSON.stringify(response));
  } catch (err) {
    console.log(JSON.stringify({ id: null, error: { code: -32700, message: "Parse error" } }));
  }
});

// Signal ready
console.log(JSON.stringify({ ready: true }));
