import type { RemoteThreadListAdapter, RemoteThreadListResponse, RemoteThreadMetadata } from "@assistant-ui/react";
import type { AssistantStreamChunk, AssistantStream } from "assistant-stream";
import { sendMessage, type AgentConfig } from "@/services/agent";
import { ensureThread, listThreads, updateThreadTitle, setThreadStatus, deleteThread } from "@/lib/threadHistory";

type AdapterDeps = {
  getSettings: () => {
    activeProvider: string;
    providers: Record<string, { apiKey: string; model: string; baseUrl?: string }>;
  };
  confirmDelete?: (title: string) => boolean;
};

const sanitizeTitle = (title: string) => title.replace(/[\r\n]+/g, " ").trim();

const createTitleStream = (title: string): AssistantStream => {
  const text = title || "New Chat";
  return new ReadableStream<AssistantStreamChunk>({
    start(controller) {
      controller.enqueue({
        type: "part-start",
        path: [0],
        part: { type: "text" },
      });
      controller.enqueue({
        type: "text-delta",
        path: [0],
        textDelta: text,
      });
      controller.enqueue({ type: "part-finish", path: [0] });
      controller.enqueue({
        type: "message-finish",
        path: [],
        finishReason: "stop",
        usage: { promptTokens: 0, completionTokens: 0 },
      });
      controller.close();
    },
  });
};

const buildTitlePrompt = (message: string) =>
  `Generate a short, friendly title (max 6 words). Return plain text only.\n\n${message}`;

const generateTitleWithModel = async (deps: AdapterDeps, message: string): Promise<string | null> => {
  const settings = deps.getSettings();
  const cfg = settings.providers[settings.activeProvider];
  if (!cfg?.apiKey || !cfg?.model) return null;
  const requestId = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `title-${Date.now()}`;
  const result = await sendMessage(
    {
      provider: settings.activeProvider as AgentConfig["provider"],
      apiKey: cfg.apiKey,
      model: cfg.model,
      baseUrl: cfg.baseUrl,
    },
    [
      { role: "system", content: "You are a helpful assistant that creates concise chat titles." },
      { role: "user", content: buildTitlePrompt(message) },
    ],
    requestId,
    null
  );
  return sanitizeTitle(result);
};

const fallbackTitle = (message: string) => {
  const cleaned = sanitizeTitle(message);
  if (!cleaned) return "New Chat";
  return cleaned.length > 42 ? `${cleaned.slice(0, 42)}…` : cleaned;
};

const getFirstUserMessage = (messages: readonly any[]) => {
  const user = messages.find((m) => m?.role === "user");
  const content = Array.isArray(user?.content)
    ? user.content.map((p: any) => (p?.type === "text" ? p.text : "")).join("\n")
    : user?.content ?? "";
  return typeof content === "string" ? content : "";
};

export const createThreadListAdapter = (deps: AdapterDeps): RemoteThreadListAdapter => {
  return {
    async list(): Promise<RemoteThreadListResponse> {
      const threads = await listThreads();
      return {
        threads: threads.map((t) => ({
          remoteId: t.id,
          externalId: undefined,
          title: t.title,
          status: t.status,
        })),
      };
    },
    async initialize(threadId: string) {
      await ensureThread(threadId);
      return { remoteId: threadId, externalId: undefined };
    },
    async fetch(threadId: string): Promise<RemoteThreadMetadata> {
      const threads = await listThreads();
      const found = threads.find((t) => t.id === threadId);
      if (!found) throw new Error("Thread not found");
      return {
        remoteId: found.id,
        externalId: undefined,
        title: found.title,
        status: found.status,
      };
    },
    async rename(remoteId: string, newTitle: string) {
      await updateThreadTitle(remoteId, sanitizeTitle(newTitle));
    },
    async archive(remoteId: string) {
      await setThreadStatus(remoteId, "archived");
    },
    async unarchive(remoteId: string) {
      await setThreadStatus(remoteId, "regular");
    },
    async delete(remoteId: string) {
      const threads = await listThreads();
      const title = threads.find((t) => t.id === remoteId)?.title ?? "this thread";
      const confirm = deps.confirmDelete ?? ((label: string) => window.confirm(`Delete ${label}?`));
      if (!confirm(title)) return;
      await deleteThread(remoteId);
    },
    async generateTitle(remoteId: string, unstable_messages: readonly any[]): Promise<AssistantStream> {
      const firstMessage = getFirstUserMessage(unstable_messages);
      let title = fallbackTitle(firstMessage);
      try {
        const modelTitle = await generateTitleWithModel(deps, firstMessage);
        if (modelTitle) title = modelTitle;
      } catch {
        // fallback already set
      }
      await updateThreadTitle(remoteId, title);
      return createTitleStream(title);
    },
  };
};
