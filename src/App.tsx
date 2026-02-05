import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { listen } from "@tauri-apps/api/event";
import { join } from "@tauri-apps/api/path";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readDir } from "@tauri-apps/plugin-fs";
import {
  AssistantRuntimeProvider,
  type ChatModelAdapter,
  useLocalRuntime,
  useThreadList,
} from "@assistant-ui/react";
import { Thread, ThreadList } from "@assistant-ui/react-ui";
import {
  Sparkles,
  Settings,
  FolderOpen,
  Folder,
  FileText,
  ChevronDown,
  ChevronRight,
  PanelRight,
  Bot,
} from "lucide-react";

import { pingSidecar, sendMessage } from "@/services/agent";
import type { WorkspaceEntry } from "@/types";
import { useSettings } from "@/hooks/useSettings";
import { SkillsPanel } from "@/components/SkillsPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { AssistantMessage } from "@/components/AssistantMessage";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PROVIDER_PRESETS } from "@/lib/providers";

type StreamController = {
  push: (delta: string) => void;
  close: () => void;
  iterator: AsyncGenerator<string, void>;
};

const createStreamController = (): StreamController => {
  let done = false;
  let pendingResolve: ((value: IteratorResult<string, void>) => void) | null = null;
  const queue: string[] = [];

  const push = (delta: string) => {
    if (!delta) return;
    if (pendingResolve) {
      pendingResolve({ value: delta, done: false });
      pendingResolve = null;
      return;
    }
    queue.push(delta);
  };

  const close = () => {
    done = true;
    if (pendingResolve) {
      pendingResolve({ value: undefined, done: true });
      pendingResolve = null;
    }
  };

  const iterator = (async function* () {
    while (true) {
      if (queue.length > 0) {
        yield queue.shift() as string;
        continue;
      }
      if (done) return;
      const next = await new Promise<IteratorResult<string, void>>((resolve) => {
        pendingResolve = resolve;
      });
      if (next.done) return;
      if (next.value) yield next.value;
    }
  })();

  return { push, close, iterator };
};

type EventStreamController<T> = {
  push: (value: T) => void;
  close: () => void;
  iterator: AsyncGenerator<T, void>;
};

const createEventStreamController = <T,>(): EventStreamController<T> => {
  let done = false;
  let pendingResolve: ((value: IteratorResult<T, void>) => void) | null = null;
  const queue: T[] = [];

  const push = (value: T) => {
    if (pendingResolve) {
      pendingResolve({ value, done: false });
      pendingResolve = null;
      return;
    }
    queue.push(value);
  };

  const close = () => {
    done = true;
    if (pendingResolve) {
      pendingResolve({ value: undefined, done: true });
      pendingResolve = null;
    }
  };

  const iterator = (async function* () {
    while (true) {
      if (queue.length > 0) {
        yield queue.shift() as T;
        continue;
      }
      if (done) return;
      const next = await new Promise<IteratorResult<T, void>>((resolve) => {
        pendingResolve = resolve;
      });
      if (next.done) return;
      if (next.value !== undefined) yield next.value;
    }
  })();

  return { push, close, iterator };
};

type ToolStatusPayload = {
  requestId?: string | null;
  stage?: string | null;
  tool?: string | null;
  detail?: unknown;
};

type ToolCallPart = {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: unknown;
  argsText: string;
  result?: unknown;
  isError?: boolean;
};

const safeStringify = (value: unknown, maxLength = 240) => {
  try {
    const text = JSON.stringify(
      value,
      (_key, v) => (typeof v === "bigint" ? v.toString() : v),
      2
    );
    if (!text) return "";
    return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
  } catch {
    try {
      const text = String(value ?? "");
      if (!text) return "";
      return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
    } catch {
      return "";
    }
  }
};

const formatToolArgsText = (detail: unknown) => {
  if (detail == null) return "";
  if (typeof detail === "string") return detail;
  return safeStringify(detail, 240);
};

const extractMessageText = (message: { content?: readonly unknown[] }) => {
  if (!Array.isArray(message.content)) return "";
  return message.content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const p = part as { type?: string; text?: string };
      return p.type === "text" ? p.text ?? "" : "";
    })
    .join("\n")
    .trim();
};

function WorkspaceTree({
  rootPath,
  workspaceEntries,
  expandedPaths,
  toggleDirectory,
}: {
  rootPath: string;
  workspaceEntries: Record<string, WorkspaceEntry[]>;
  expandedPaths: Record<string, boolean>;
  toggleDirectory: (path: string) => Promise<void>;
}) {
  const renderWorkspaceEntries = useCallback(
    (path: string, depth = 0): React.ReactNode => {
      const entries = workspaceEntries[path];
      if (!entries) return <div className="py-2 text-xs text-muted-foreground">Loading folder...</div>;
      if (entries.length === 0) return <div className="py-2 text-xs text-muted-foreground">Empty folder</div>;

      return entries.map((entry) => {
        const isExpanded = !!expandedPaths[entry.path];
        const paddingLeft = 12 + depth * 14;

        if (entry.isDirectory) {
          return (
            <div key={entry.path}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md py-1 text-left text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                style={{ paddingLeft }}
                onClick={() => {
                  void toggleDirectory(entry.path);
                }}
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <Folder className="h-3.5 w-3.5" />
                <span className="truncate">{entry.name}</span>
              </button>
              {isExpanded ? renderWorkspaceEntries(entry.path, depth + 1) : null}
            </div>
          );
        }

        return (
          <div
            key={entry.path}
            className="flex items-center gap-2 py-1 text-xs text-muted-foreground"
            style={{ paddingLeft: paddingLeft + 18 }}
          >
            <FileText className="h-3.5 w-3.5" />
            <span className="truncate">{entry.name}</span>
          </div>
        );
      });
    },
    [expandedPaths, toggleDirectory, workspaceEntries]
  );

  return <>{renderWorkspaceEntries(rootPath)}</>;
}

function StudioShell({
  settings,
  saveSettings,
  workspaceByThreadId,
  setWorkspaceByThreadId,
}: {
  settings: ReturnType<typeof useSettings>["settings"];
  saveSettings: ReturnType<typeof useSettings>["saveSettings"];
  workspaceByThreadId: Record<string, string>;
  setWorkspaceByThreadId: Dispatch<SetStateAction<Record<string, string>>>;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);

  const [workspaceEntries, setWorkspaceEntries] = useState<Record<string, WorkspaceEntry[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const activeThreadId = useThreadList((t) => t.mainThreadId);
  const activeWorkspacePath = workspaceByThreadId[activeThreadId];

  const loadDirectory = useCallback(async (path: string) => {
    try {
      setWorkspaceError(null);
      const entries = await readDir(path);
      const mappedEntries = await Promise.all(
        entries.map(async (entry) => ({
          name: entry.name,
          path: await join(path, entry.name),
          isDirectory: entry.isDirectory,
          isFile: entry.isFile,
        }))
      );
      mappedEntries.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
        return a.isDirectory ? -1 : 1;
      });
      setWorkspaceEntries((prev) => ({ ...prev, [path]: mappedEntries }));
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Failed to read folder");
    }
  }, []);

  const handleSelectWorkspace = useCallback(async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: "Select workspace folder",
    });
    if (!selected || Array.isArray(selected)) return;

    setWorkspaceByThreadId((prev) => ({ ...prev, [activeThreadId]: selected }));
    setExpandedPaths((prev) => ({ ...prev, [selected]: true }));
    setStudioOpen(true);
    await loadDirectory(selected);
  }, [activeThreadId, loadDirectory, setWorkspaceByThreadId]);

  const toggleDirectory = useCallback(
    async (path: string) => {
      const isExpanded = !!expandedPaths[path];
      setExpandedPaths((prev) => ({ ...prev, [path]: !isExpanded }));
      if (!isExpanded && !workspaceEntries[path]) await loadDirectory(path);
    },
    [expandedPaths, loadDirectory, workspaceEntries]
  );

  const handleSaveSettings = async (nextSettings: typeof settings) => {
    const success = await saveSettings(nextSettings);
    if (success) setSettingsOpen(false);
    return success;
  };

  return (
    <>
      <div className="relative h-svh overflow-hidden bg-[radial-gradient(circle_at_10%_10%,rgba(60,86,130,0.35),transparent_45%),radial-gradient(circle_at_90%_0%,rgba(120,72,35,0.25),transparent_40%),linear-gradient(160deg,#0b0b0f_0%,#10131a_55%,#0a0c11_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:24px_24px]" />

        <div
          className={`relative grid h-full w-full grid-cols-1 ${
            studioOpen
              ? "lg:grid-cols-[260px_minmax(0,1fr)_420px] xl:grid-cols-[280px_minmax(0,1fr)_460px]"
              : "lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]"
          }`}
        >
          <aside className="flex min-h-0 flex-col border-r border-white/10 bg-[#0f1117]/80 p-3 backdrop-blur-md">
            <div className="mb-3 flex items-center gap-2">
              <Bot className="h-5 w-5 text-orange-600" />
              <div>
                <div className="text-sm font-semibold">OhMyCowork</div>
                <div className="text-[11px] text-muted-foreground">AI Workspace</div>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <ThreadList />
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={() => setSkillsOpen(true)}>
                  <Sparkles className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setSettingsOpen(true)}>
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </aside>

          <section className="flex min-h-0 flex-col border-r border-white/10 bg-[#0f1117]/85 backdrop-blur-md">
              <header className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {settings.activeProvider} · {settings.providers[settings.activeProvider]?.model || "Not configured"}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!studioOpen ? (
                    <Button size="sm" variant="outline" className="h-8" onClick={() => void handleSelectWorkspace()}>
                      <FolderOpen className="mr-1 h-3.5 w-3.5" />
                      {activeWorkspacePath ? "Change Workspace" : "Open Workspace"}
                    </Button>
                  ) : null}
                  <Button size="icon" variant="ghost" onClick={() => setStudioOpen((prev) => !prev)}>
                    <PanelRight className="h-4 w-4" />
                  </Button>
                </div>
              </header>

              <div className="min-h-0 flex-1 p-2">
                <Thread
                  welcome={{
                    message: "Welcome. Talk through ideas, then shape them into clear output.",
                    suggestions: [
                      { prompt: "Plan a new UI architecture for this repository", text: "UI Architecture Plan" },
                      { prompt: "Create a refactor plan based on the current workspace", text: "Refactor Plan" },
                      { prompt: "List the next test checklist items", text: "Test Checklist" },
                    ],
                  }}
                  components={{
                    AssistantMessage,
                  }}
                  strings={{
                    composer: {
                      input: { placeholder: "Type a message..." },
                    },
                  }}
                />
              </div>
          </section>

            {studioOpen ? (
              <aside className="flex min-h-0 flex-col bg-[#0d0f14]/95 backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                  <div className="text-sm font-semibold">Workspace</div>
                  <Button size="sm" variant="outline" onClick={() => void handleSelectWorkspace()}>
                    {activeWorkspacePath ? "Change" : "Open"}
                  </Button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col p-3">
                  <div className="mb-2 min-w-0">
                    <div className="text-xs text-muted-foreground">Root</div>
                    <div className="truncate text-xs text-muted-foreground">{activeWorkspacePath ?? "No workspace selected"}</div>
                  </div>

                  {workspaceError ? (
                    <div className="mb-2 rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-600">{workspaceError}</div>
                  ) : null}

                  <div className="min-h-0 flex-1 rounded-lg border border-white/10 bg-[#0f131a] p-2">
                    <ScrollArea className="h-full">
                      {activeWorkspacePath ? (
                        <WorkspaceTree
                          rootPath={activeWorkspacePath}
                          workspaceEntries={workspaceEntries}
                          expandedPaths={expandedPaths}
                          toggleDirectory={toggleDirectory}
                        />
                      ) : (
                        <div className="text-xs text-muted-foreground">File tree appears after opening a workspace.</div>
                      )}
                    </ScrollArea>
                  </div>
                </div>
              </aside>
            ) : null}
        </div>
      </div>

      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        providers={PROVIDER_PRESETS}
        onSave={handleSaveSettings}
      />
      <SkillsPanel open={skillsOpen} onOpenChange={setSkillsOpen} workspacePath={activeWorkspacePath} />
    </>
  );
}

function App() {
  const { settings, saveSettings } = useSettings();
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const pingedRef = useRef(false);
  useEffect(() => {
    if (pingedRef.current) return;
    pingedRef.current = true;
    void pingSidecar().catch(() => {
      // Best effort warmup; ignore failures.
    });
  }, []);

  const [workspaceByThreadId, setWorkspaceByThreadId] = useState<Record<string, string>>({});
  const workspaceByThreadIdRef = useRef(workspaceByThreadId);
  useEffect(() => {
    workspaceByThreadIdRef.current = workspaceByThreadId;
  }, [workspaceByThreadId]);

  const streamByRequestIdRef = useRef<Record<string, StreamController>>({});
  const toolStreamByRequestIdRef = useRef<Record<string, EventStreamController<ToolStatusPayload>>>({});

  const adapter = useMemo<ChatModelAdapter>(
    () => ({
      run({ messages, unstable_threadId }) {
        const threadId = unstable_threadId ?? "main";
        const current = settingsRef.current;
        const providerConfig = current.providers[current.activeProvider];

        if (!providerConfig?.apiKey || !providerConfig?.model) {
          throw new Error("Provider API key or model missing. Open settings to configure.");
        }

        const requestId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `req-${Date.now()}`;

        const chatMessages = messages
          .map((message) => ({ role: message.role, content: extractMessageText(message) }))
          .filter((message) => message.content.length > 0);

        const streamController = createStreamController();
        streamByRequestIdRef.current[requestId] = streamController;
        const toolStreamController = createEventStreamController<ToolStatusPayload>();
        toolStreamByRequestIdRef.current[requestId] = toolStreamController;

        return (async function* () {
          let streamedText = "";
          let lastSignature = "";
          const toolCalls = new Map<string, ToolCallPart>();
          const toolCallOrder: string[] = [];
          const openToolCallsByName = new Map<string, string[]>();
          let toolCounter = 0;

          const buildContentParts = () => {
            const parts: Array<{ type: "text"; text: string } | ToolCallPart> = [];
            if (streamedText) parts.push({ type: "text", text: streamedText });
            for (const id of toolCallOrder) {
              const part = toolCalls.get(id);
              if (part) parts.push(part);
            }
            return parts;
          };

          const signatureForParts = () =>
            JSON.stringify({
              text: streamedText,
              tools: toolCallOrder.map((id) => {
                const part = toolCalls.get(id);
                if (!part) return null;
                return [
                  part.toolCallId,
                  part.toolName,
                  part.argsText,
                  safeStringify(part.result, 240),
                  part.isError,
                ];
              }),
            });

          const emitIfChanged = () => {
            try {
              const parts = buildContentParts();
              if (!parts.length) return null;
              const signature = signatureForParts();
              if (signature === lastSignature) return null;
              lastSignature = signature;
              return { content: parts };
            } catch {
              return { content: [{ type: "text", text: streamedText }] };
            }
          };

          const createToolCall = (toolName: string, detail: unknown) => {
            const toolCallId = `${requestId}-tool-${toolCounter++}`;
            const argsText = formatToolArgsText(detail);
            const args = argsText ? { detail: argsText } : {};
            const part: ToolCallPart = {
              type: "tool-call",
              toolCallId,
              toolName,
              args,
              argsText,
            };
            toolCalls.set(toolCallId, part);
            toolCallOrder.push(toolCallId);
            const queue = openToolCallsByName.get(toolName) ?? [];
            queue.push(toolCallId);
            openToolCallsByName.set(toolName, queue);
            return toolCallId;
          };

          const resolveToolCallId = (toolName: string) => {
            const queue = openToolCallsByName.get(toolName);
            if (!queue || queue.length === 0) return null;
            while (queue.length > 0) {
              const candidate = queue[queue.length - 1];
              const part = toolCalls.get(candidate);
              if (part && part.result === undefined && !part.isError) return candidate;
              queue.pop();
            }
            return null;
          };

          const handleToolEvent = (payload: ToolStatusPayload) => {
            try {
              const toolName = payload.tool ?? null;
              const stage = payload.stage ?? null;
              if (!toolName) return emitIfChanged();

              if (stage === "tool_start") {
                createToolCall(toolName, payload.detail);
              } else if (stage === "tool_end" || stage === "tool_error") {
                let toolCallId = resolveToolCallId(toolName);
                if (!toolCallId) {
                  toolCallId = createToolCall(toolName, payload.detail);
                }
                const part = toolCalls.get(toolCallId);
                if (part) {
                  const resultText = formatToolArgsText(payload.detail);
                  part.result = resultText || (stage === "tool_error" ? "Error" : "Done");
                  part.isError = stage === "tool_error";
                }
              }

              return emitIfChanged();
            } catch {
              return emitIfChanged();
            }
          };

          let output = "";
          let sendError: unknown = null;
          const sendPromise = sendMessage(
            {
              provider: current.activeProvider,
              apiKey: providerConfig.apiKey,
              model: providerConfig.model,
              baseUrl: providerConfig.baseUrl,
            },
            chatMessages,
            requestId,
            workspaceByThreadIdRef.current[threadId] ?? null
          )
          .then((result) => {
            output = result;
            return result;
          })
          .catch((err) => {
            sendError = err;
            throw err;
          });

          let textDone = false;
          let toolDone = false;
          let textNext = streamController.iterator.next().then((res) => ({ source: "text" as const, res }));
          let toolNext = toolStreamController.iterator.next().then((res) => ({ source: "tool" as const, res }));
          let sendDone = false;
          const doneNext = sendPromise
            .then(() => ({ source: "done" as const }))
            .catch((err) => ({ source: "error" as const, err }));

          while (!textDone || !toolDone || !sendDone) {
            const pending = [];
            if (!textDone) pending.push(textNext);
            if (!toolDone) pending.push(toolNext);
            if (!sendDone) pending.push(doneNext);
            if (!pending.length) break;

            const { source, res } = await Promise.race(pending);
            if (source === "done") {
              sendDone = true;
              textDone = true;
              toolDone = true;
              streamController.close();
              toolStreamController.close();
            } else if (source === "error") {
              sendDone = true;
              textDone = true;
              toolDone = true;
              streamController.close();
              toolStreamController.close();
              sendError = res?.err ?? sendError;
            } else if (source === "text") {
              if (res.done) {
                textDone = true;
              } else if (res.value) {
                streamedText += res.value;
                const update = emitIfChanged();
                if (update) yield update;
              }
              if (!textDone) {
                textNext = streamController.iterator.next().then((nextRes) => ({ source: "text" as const, res: nextRes }));
              }
            } else {
              if (res.done) {
                toolDone = true;
              } else if (res.value) {
                const update = handleToolEvent(res.value);
                if (update) yield update;
              }
              if (!toolDone) {
                toolNext = toolStreamController.iterator.next().then((nextRes) => ({ source: "tool" as const, res: nextRes }));
              }
            }
          }

          delete streamByRequestIdRef.current[requestId];
          delete toolStreamByRequestIdRef.current[requestId];

          if (sendError) {
            const message = sendError instanceof Error ? sendError.message : String(sendError);
            yield { content: [{ type: "text", text: `Error: ${message}` }] };
            yield { status: { type: "complete", reason: "error" } };
            return;
          }
          if (!streamedText && output) {
            streamedText = output;
            const update = emitIfChanged();
            if (update) yield update;
          } else if (output && output.startsWith(streamedText)) {
            const remaining = output.slice(streamedText.length);
            if (remaining) {
              streamedText += remaining;
              const update = emitIfChanged();
              if (update) yield update;
            }
          } else if (output && output !== streamedText) {
            streamedText = output;
            const update = emitIfChanged();
            if (update) yield update;
          }

          yield { status: { type: "complete", reason: "unknown" } };
        })();
      },
    }),
    []
  );

  const runtime = useLocalRuntime(adapter);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let disposed = false;

    const startListening = async () => {
      const off = await listen("agent:delta", (event) => {
        const payload = event.payload as {
          requestId?: string | null;
          delta?: string | null;
        };

        const requestId = payload.requestId;
        if (!requestId || !payload.delta) return;
        const controller = streamByRequestIdRef.current[requestId];
        if (!controller) return;
        controller.push(payload.delta);
      });

      if (disposed) off();
      else unlisten = off;
    };

    void startListening();
    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let disposed = false;

    const startListening = async () => {
      const off = await listen("agent:status", (event) => {
        const payload = event.payload as ToolStatusPayload;
        const requestId = payload.requestId ?? null;
        if (!requestId) return;
        const controller = toolStreamByRequestIdRef.current[requestId];
        if (!controller) return;
        controller.push(payload);
      });

      if (disposed) off();
      else unlisten = off;
    };

    void startListening();
    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, []);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <StudioShell
        settings={settings}
        saveSettings={saveSettings}
        workspaceByThreadId={workspaceByThreadId}
        setWorkspaceByThreadId={setWorkspaceByThreadId}
      />
    </AssistantRuntimeProvider>
  );
}

export default App;
