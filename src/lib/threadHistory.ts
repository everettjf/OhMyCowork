import { Store } from "@tauri-apps/plugin-store";
import type { ThreadHistoryAdapter } from "@assistant-ui/react";
import type { ExportedMessageRepository, ExportedMessageRepositoryItem } from "@assistant-ui/react";

export type ThreadMetadata = {
  id: string;
  title?: string;
  status: "regular" | "archived";
  createdAt: string;
  updatedAt: string;
};

type ThreadStoreData = {
  threads: Record<string, ThreadMetadata>;
  order: string[];
  histories: Record<string, ExportedMessageRepository>;
};

const HISTORY_STORE = "threadHistory.json";
const STORE_KEY = "threadStore";
const LEGACY_HISTORY_KEY = "mainThreadHistory";
const MAIN_THREAD_ID = "main";

const reviveDate = (value: unknown) => {
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return value;
};

const reviveRepository = (repo?: ExportedMessageRepository | null): ExportedMessageRepository => {
  if (!repo || !Array.isArray(repo.messages)) {
    return { messages: [], headId: null };
  }
  return {
    headId: repo.headId ?? null,
    messages: repo.messages.map((item) => {
      const message = item.message;
      const createdAt = reviveDate(message.createdAt) as Date;
      return {
        ...item,
        message: {
          ...message,
          createdAt,
        },
      };
    }),
  };
};

const deepSerialize = <T,>(value: T): T => {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (v instanceof Date) return v.toISOString();
      if (typeof v === "bigint") return v.toString();
      if (v instanceof Error) return v.message;
      return v;
    })
  ) as T;
};

const serializeRepository = (repo: ExportedMessageRepository): ExportedMessageRepository => {
  const serialized = deepSerialize(repo);
  return {
    headId: serialized.headId ?? null,
    messages: serialized.messages.map((item) => ({
      ...item,
      message: {
        ...item.message,
        createdAt: item.message.createdAt,
      },
    })),
  };
};

const loadStore = async () => Store.load(HISTORY_STORE);

const emptyStore = (): ThreadStoreData => ({
  threads: {},
  order: [],
  histories: {},
});

const nowIso = () => new Date().toISOString();

const reviveStore = (data?: ThreadStoreData | null): ThreadStoreData => {
  if (!data || typeof data !== "object") return emptyStore();
  return {
    threads: data.threads ?? {},
    order: Array.isArray(data.order) ? data.order : [],
    histories: data.histories ?? {},
  };
};

const saveStoreData = async (store: Store, data: ThreadStoreData) => {
  await store.set(STORE_KEY, data);
  await store.save();
};

const ensureMainThread = (data: ThreadStoreData) => {
  if (!data.threads[MAIN_THREAD_ID]) {
    const timestamp = nowIso();
    data.threads[MAIN_THREAD_ID] = {
      id: MAIN_THREAD_ID,
      title: "New Chat",
      status: "regular",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    data.order = [MAIN_THREAD_ID, ...data.order.filter((id) => id !== MAIN_THREAD_ID)];
  }
};

const migrateLegacy = async (store: Store, data: ThreadStoreData): Promise<ThreadStoreData> => {
  if (data.order.length > 0 || Object.keys(data.threads).length > 0) return data;
  const legacy = await store.get<ExportedMessageRepository>(LEGACY_HISTORY_KEY);
  if (!legacy) return data;
  const timestamp = nowIso();
  data.threads[MAIN_THREAD_ID] = {
    id: MAIN_THREAD_ID,
    title: "New Chat",
    status: "regular",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  data.order = [MAIN_THREAD_ID];
  data.histories[MAIN_THREAD_ID] = serializeRepository(legacy);
  await saveStoreData(store, data);
  return data;
};

const loadThreadStore = async (): Promise<ThreadStoreData> => {
  const store = await loadStore();
  const raw = await store.get<ThreadStoreData>(STORE_KEY);
  let data = reviveStore(raw);
  data = await migrateLegacy(store, data);
  ensureMainThread(data);
  return data;
};

const saveThreadStore = async (data: ThreadStoreData): Promise<void> => {
  const store = await loadStore();
  await saveStoreData(store, data);
};

export const listThreads = async (): Promise<ThreadMetadata[]> => {
  const data = await loadThreadStore();
  return data.order
    .map((id) => data.threads[id])
    .filter(Boolean);
};

export const ensureThread = async (threadId: string): Promise<void> => {
  const data = await loadThreadStore();
  if (!data.threads[threadId]) {
    const timestamp = nowIso();
    data.threads[threadId] = {
      id: threadId,
      title: "New Chat",
      status: "regular",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    data.order = [threadId, ...data.order.filter((id) => id !== threadId)];
  }
  if (!data.histories[threadId]) {
    data.histories[threadId] = { messages: [], headId: null };
  }
  await saveThreadStore(data);
};

export const updateThreadTitle = async (threadId: string, title: string): Promise<void> => {
  const data = await loadThreadStore();
  if (!data.threads[threadId]) {
    await ensureThread(threadId);
    return updateThreadTitle(threadId, title);
  }
  data.threads[threadId] = {
    ...data.threads[threadId],
    title,
    updatedAt: nowIso(),
  };
  await saveThreadStore(data);
};

export const setThreadStatus = async (threadId: string, status: "regular" | "archived"): Promise<void> => {
  const data = await loadThreadStore();
  if (!data.threads[threadId]) return;
  data.threads[threadId] = {
    ...data.threads[threadId],
    status,
    updatedAt: nowIso(),
  };
  await saveThreadStore(data);
};

export const deleteThread = async (threadId: string): Promise<void> => {
  const data = await loadThreadStore();
  delete data.threads[threadId];
  delete data.histories[threadId];
  data.order = data.order.filter((id) => id !== threadId);
  ensureMainThread(data);
  await saveThreadStore(data);
};

export const loadThreadHistory = async (threadId: string): Promise<ExportedMessageRepository> => {
  const data = await loadThreadStore();
  const repo = data.histories[threadId] ?? { messages: [], headId: null };
  return reviveRepository(repo);
};

export const appendThreadHistory = async (threadId: string, item: ExportedMessageRepositoryItem): Promise<void> => {
  const data = await loadThreadStore();
  if (!data.histories[threadId]) {
    data.histories[threadId] = { messages: [], headId: null };
  }
  const existing = data.histories[threadId];
  const next: ExportedMessageRepository = {
    headId: item.message.id,
    messages: [...existing.messages, item],
  };
  data.histories[threadId] = serializeRepository(next);
  await saveThreadStore(data);
};

export const serializeThreadHistory = (repo: ExportedMessageRepository): string => {
  return JSON.stringify(serializeRepository(repo), null, 2);
};

const formatPart = (part: any): string => {
  if (!part || typeof part !== "object") return "";
  switch (part.type) {
    case "text":
      return part.text ?? "";
    case "tool-call": {
      const header = `[tool:${part.toolName ?? "unknown"}]`;
      const args = part.argsText ? `\n${part.argsText}` : "";
      const result = part.result ? `\n${typeof part.result === "string" ? part.result : JSON.stringify(part.result, null, 2)}` : "";
      return `${header}${args}${result}`;
    }
    case "source":
      return `[source] ${part.url ?? ""}`;
    case "file":
      return `[file] ${part.filename ?? "attachment"}`;
    case "image":
      return `[image] ${part.filename ?? "image"}`;
    case "reasoning":
      return "";
    default:
      try {
        return JSON.stringify(part);
      } catch {
        return String(part);
      }
  }
};

export const formatThreadHistoryMarkdown = (repo: ExportedMessageRepository, title?: string): string => {
  const exportedAt = new Date().toISOString();
  const lines: string[] = [];
  lines.push(`# ${title || "Thread Export"}`);
  lines.push("");
  lines.push(`- Exported: ${exportedAt}`);
  lines.push(`- Messages: ${repo.messages.length}`);
  lines.push("");

  for (const item of repo.messages) {
    const message: any = item.message;
    const role = message?.role ?? "unknown";
    const createdAt = message?.createdAt ? new Date(message.createdAt).toISOString() : "";
    lines.push(`## ${role}${createdAt ? ` · ${createdAt}` : ""}`);
    const content = Array.isArray(message?.content) ? message.content : [];
    const parts = content.map(formatPart).filter(Boolean);
    lines.push(parts.length ? parts.join("\n\n") : "_(no content)_");
    lines.push("");
  }

  return lines.join("\n");
};

const extractMessageText = (message: any): string => {
  const content = Array.isArray(message?.content) ? message.content : [];
  return content
    .map((part: any) => (part?.type === "text" ? part.text ?? "" : ""))
    .join("\n")
    .trim();
};

export const createThreadHistoryAdapter = (
  getThreadId: () => string,
  onFirstUserMessage?: (threadId: string, text: string) => void | Promise<void>
): ThreadHistoryAdapter => {
  return {
    async load() {
      const threadId = getThreadId() || MAIN_THREAD_ID;
      return loadThreadHistory(threadId);
    },
    async append(item: ExportedMessageRepositoryItem) {
      const threadId = getThreadId() || MAIN_THREAD_ID;
      const current = await loadThreadHistory(threadId);
      const isFirstUser = current.messages.length === 0 && item.message?.role === "user";
      await appendThreadHistory(threadId, item);
      if (isFirstUser && onFirstUserMessage) {
        const text = extractMessageText(item.message);
        if (text) await onFirstUserMessage(threadId, text);
      }
    },
  };
};
