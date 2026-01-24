import { ChatOpenAI } from "@langchain/openai";
import { NoopBackend } from "@/lib/agent-backend";
import type { AgentConfig, ChatMessage } from "@/types";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

// 缓存 deepagents 模块，确保只加载一次
let deepagentsModule: typeof import("deepagents") | null = null;

async function getDeepAgents() {
  if (!deepagentsModule) {
    deepagentsModule = await import("deepagents");
  }
  return deepagentsModule;
}

// 预加载模块（应用启动时调用）
export function preloadAgent() {
  getDeepAgents().catch(console.error);
}

export function createChatModel(config: AgentConfig) {
  return new ChatOpenAI({
    apiKey: config.apiKey,
    model: config.model,
    configuration: {
      baseURL: config.baseUrl || DEFAULT_BASE_URL,
      dangerouslyAllowBrowser: true,
      defaultHeaders: {
        "HTTP-Referer": "https://ohmyco.work",
        "X-Title": "Oh My Cowork",
      },
    },
  });
}

export async function createAgent(
  config: AgentConfig,
  workspacePath?: string | null
) {
  const model = createChatModel(config);
  const { createDeepAgent } = await getDeepAgents();

  return createDeepAgent({
    model,
    backend: () => new NoopBackend(),
    systemPrompt: workspacePath
      ? `You are a helpful coworker assistant. The current workspace root is ${workspacePath}.`
      : "You are a helpful coworker assistant.",
  });
}

export function formatMessageContent(content: unknown): string {
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

export async function sendMessage(
  config: AgentConfig,
  messages: ChatMessage[],
  workspacePath?: string | null
): Promise<string> {
  const agent = await createAgent(config, workspacePath);

  const runtimeMessages = [...messages];
  if (workspacePath) {
    runtimeMessages.unshift({
      role: "system",
      content: `Current workspace folder: ${workspacePath}`,
    });
  }

  const result = await agent.invoke({ messages: runtimeMessages });

  const responseMessages = (
    result as { messages?: Array<{ content?: unknown }> }
  ).messages;
  const lastMessage = responseMessages?.[responseMessages.length - 1];

  return formatMessageContent(lastMessage?.content) || "No response from model.";
}
