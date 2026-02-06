import { Store } from "@tauri-apps/plugin-store";
import type { ThreadHistoryAdapter } from "@assistant-ui/react";

type ExportedMessageRepositoryItem = {
  message: { createdAt: Date | string; id: string; [key: string]: unknown };
  parentId: string | null;
  runConfig?: unknown;
};

type ExportedMessageRepository = {
  headId?: string | null;
  messages: ExportedMessageRepositoryItem[];
};

const HISTORY_STORE = "threadHistory.json";
const HISTORY_KEY = "mainThreadHistory";

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

const serializeRepository = (repo: ExportedMessageRepository): ExportedMessageRepository => {
  return {
    headId: repo.headId ?? null,
    messages: repo.messages.map((item) => ({
      ...item,
      message: {
        ...item.message,
        createdAt: item.message.createdAt instanceof Date ? item.message.createdAt.toISOString() : item.message.createdAt,
      },
    })),
  };
};

const loadStore = async () => Store.load(HISTORY_STORE);

export const createThreadHistoryAdapter = (): ThreadHistoryAdapter => {
  return {
    async load() {
      const store = await loadStore();
      const repo = (await store.get<ExportedMessageRepository>(HISTORY_KEY)) ?? { messages: [], headId: null };
      return reviveRepository(repo);
    },
    async append(item: ExportedMessageRepositoryItem) {
      const store = await loadStore();
      const existing = (await store.get<ExportedMessageRepository>(HISTORY_KEY)) ?? { messages: [], headId: null };
      const next: ExportedMessageRepository = {
        headId: item.message.id,
        messages: [...existing.messages, item],
      };
      await store.set(HISTORY_KEY, serializeRepository(next));
      await store.save();
    },
  };
};
