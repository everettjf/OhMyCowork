import { ChatOpenAI } from "@langchain/openai";
import { createDeepAgent } from "deepagents";
import * as readline from "readline";
import { createInternetSearchTool } from "./tools/internet_search.js";

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

async function sendMessage(request) {
  const { apiKey, model, messages, workspacePath, tavilyApiKey } = request;

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

  // Create tools array
  const tools = [];
  if (hasTavilyKey) {
    tools.push(createInternetSearchTool(normalizedTavilyKey));
  }


  let systemPrompt = `You are an expert researcher and coworker assistant. Your job is to conduct thorough research and then write a polished report.

You have access to an internet search tool as your primary means of gathering information.

## \`internet_search\`

Use this to run an internet search for a given query. You can specify the max number of results to return, the topic, and whether raw content should be included.
`;

  // context
  if (workspacePath) {
    systemPrompt += ` The current workspace root is ${workspacePath}.`;
  }

  const agent = createDeepAgent({
    model: chatModel,
    // backend: () => new NoopBackend(),
    tools,
    systemPrompt,
  });

  const runtimeMessages = [...messages];

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
