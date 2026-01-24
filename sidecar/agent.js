import { ChatOpenAI } from "@langchain/openai";
import { createDeepAgent } from "deepagents";
import * as readline from "readline";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

class NoopBackend {
  async lsInfo() { return []; }
  async read() { return "Error: Filesystem access is not available."; }
  async grepRaw() { return "Error: Filesystem access is not available."; }
  async globInfo() { return []; }
  async write() { return { error: "permission_denied", filesUpdate: null }; }
  async edit() { return { error: "permission_denied", filesUpdate: null, occurrences: 0 }; }
  async uploadFiles(files) { return files.map(([path]) => ({ path, error: "permission_denied" })); }
  async downloadFiles(paths) { return paths.map((path) => ({ path, content: null, error: "permission_denied" })); }
}

function createChatModel(apiKey, model) {
  return new ChatOpenAI({
    apiKey,
    model,
    configuration: {
      baseURL: OPENROUTER_BASE_URL,
      defaultHeaders: {
        "HTTP-Referer": "https://ohmyco.work",
        "X-Title": "Oh My Cowork",
      },
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

async function sendMessage(request) {
  const { apiKey, model, messages, workspacePath } = request;

  const chatModel = createChatModel(apiKey, model);
  const agent = createDeepAgent({
    model: chatModel,
    backend: () => new NoopBackend(),
    systemPrompt: workspacePath
      ? `You are a helpful coworker assistant. The current workspace root is ${workspacePath}.`
      : "You are a helpful coworker assistant.",
  });

  const runtimeMessages = [...messages];
  if (workspacePath) {
    runtimeMessages.unshift({
      role: "system",
      content: `Current workspace folder: ${workspacePath}`,
    });
  }

  const result = await agent.invoke({ messages: runtimeMessages });
  const responseMessages = result.messages;
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
