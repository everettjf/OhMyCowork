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
import { openUrl } from "@tauri-apps/plugin-opener";
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
  ExternalLink,
  Bot,
  PenSquare,
  Code,
  FilePlus2,
  Layers,
} from "lucide-react";

import { sendMessage } from "@/services/agent";
import type { WorkspaceEntry } from "@/types";
import { useSettings } from "@/hooks/useSettings";
import { SkillsPanel } from "@/components/SkillsPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PROVIDER_PRESETS } from "@/lib/providers";

type CanvasMode = "markdown" | "code";

type CanvasArtifact = {
  id: string;
  path: string;
  language: string;
  content: string;
};

type ThreadCanvasState = {
  mode: CanvasMode;
  language: string;
  artifacts: CanvasArtifact[];
  activeArtifactId: string;
  newArtifactPath: string;
};

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

const cloneArtifacts = (artifacts: CanvasArtifact[]) => artifacts.map((item) => ({ ...item }));

const createDefaultCanvasState = (): ThreadCanvasState => {
  const initialArtifact = { id: makeArtifactId("document.md", 0), path: "document.md", language: "markdown", content: "" };
  return {
    mode: "markdown",
    language: "typescript",
    artifacts: [initialArtifact],
    activeArtifactId: initialArtifact.id,
    newArtifactPath: "src/new-file.ts",
  };
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

const makeArtifactId = (path: string, index: number) => `${path}::${index}::${Date.now()}`;

const sanitizePath = (value: string) => value.trim().replace(/^\/+/, "") || "untitled.txt";

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
  const [studioOpen, setStudioOpen] = useState(true);
  const [studioTab, setStudioTab] = useState<"canvas" | "workspace">("canvas");

  const [workspaceEntries, setWorkspaceEntries] = useState<Record<string, WorkspaceEntry[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const [canvasMode, setCanvasMode] = useState<CanvasMode>("markdown");
  const [canvasLanguage, setCanvasLanguage] = useState("typescript");
  const [canvasArtifacts, setCanvasArtifacts] = useState<CanvasArtifact[]>([]);
  const [activeArtifactId, setActiveArtifactId] = useState("");
  const [newArtifactPath, setNewArtifactPath] = useState("src/new-file.ts");

  const [canvasStateByThreadId, setCanvasStateByThreadId] = useState<Record<string, ThreadCanvasState>>({});
  const canvasStateByThreadIdRef = useRef<Record<string, ThreadCanvasState>>({});
  const previousThreadIdRef = useRef("");

  const activeThreadId = useThreadList((t) => t.mainThreadId);
  const activeWorkspacePath = workspaceByThreadId[activeThreadId];

  useEffect(() => {
    canvasStateByThreadIdRef.current = canvasStateByThreadId;
  }, [canvasStateByThreadId]);

  useEffect(() => {
    if (!activeThreadId) return;
    const previousThreadId = previousThreadIdRef.current;
    if (previousThreadId) {
      const snapshot: ThreadCanvasState = {
        mode: canvasMode,
        language: canvasLanguage,
        artifacts: cloneArtifacts(canvasArtifacts),
        activeArtifactId,
        newArtifactPath,
      };
      setCanvasStateByThreadId((prev) => ({ ...prev, [previousThreadId]: snapshot }));
    }

    const restored = canvasStateByThreadIdRef.current[activeThreadId] ?? createDefaultCanvasState();
    setCanvasMode(restored.mode);
    setCanvasLanguage(restored.language);
    setCanvasArtifacts(cloneArtifacts(restored.artifacts));
    setActiveArtifactId(restored.activeArtifactId);
    setNewArtifactPath(restored.newArtifactPath);
    previousThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  const activeArtifact = useMemo(
    () => canvasArtifacts.find((artifact) => artifact.id === activeArtifactId) ?? canvasArtifacts[0] ?? null,
    [activeArtifactId, canvasArtifacts]
  );

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
    setStudioTab("workspace");
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

  useEffect(() => {
    if (!activeArtifact && canvasArtifacts.length > 0) {
      setActiveArtifactId(canvasArtifacts[0].id);
    }
  }, [activeArtifact, canvasArtifacts]);



  const updateActiveArtifact = (updater: (artifact: CanvasArtifact) => CanvasArtifact) => {
    if (!activeArtifact) return;
    setCanvasArtifacts((prev) => prev.map((item) => (item.id === activeArtifact.id ? updater(item) : item)));
  };


  const addArtifact = () => {
    const path = sanitizePath(newArtifactPath);
    const language = canvasMode === "markdown" ? "markdown" : canvasLanguage || "text";
    const artifact: CanvasArtifact = {
      id: makeArtifactId(path, canvasArtifacts.length),
      path,
      language,
      content: "",
    };
    setCanvasArtifacts((prev) => [...prev, artifact]);
    setActiveArtifactId(artifact.id);
  };


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
              <div className="text-[11px] text-muted-foreground">Quick</div>
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
                  <div className="text-[11px] text-muted-foreground">Thread: {activeThreadId}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" className="h-8" onClick={() => void handleSelectWorkspace()}>
                    <FolderOpen className="mr-1 h-3.5 w-3.5" />
                    {activeWorkspacePath ? "Change Workspace" : "Open Workspace"}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setStudioOpen((prev) => !prev)}>
                    <PanelRight className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => void openUrl("https://github.com/langchain-ai/open-canvas")}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </header>

              <div className="min-h-0 flex-1 p-2">
                <Thread
                  welcome={{
                    message: "Welcome. Talk through ideas, then shape them on Canvas.",
                    suggestions: [
                      { prompt: "Plan a new UI architecture for this repository", text: "UI Architecture Plan" },
                      { prompt: "Create a refactor plan based on the current workspace", text: "Refactor Plan" },
                      { prompt: "List the next test checklist items", text: "Test Checklist" },
                    ],
                  }}
                  strings={{
                    composer: {
                      input: { placeholder: "Type a message, or edit quickly in Canvas on the right..." },
                    },
                  }}
                />
              </div>
          </section>

            {studioOpen ? (
              <aside className="flex min-h-0 flex-col bg-[#0d0f14]/95 backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                  <div className="text-sm font-semibold">Studio</div>
                  <div className="flex items-center rounded-md bg-white/10 p-1">
                    <button
                      type="button"
                      className={`rounded px-2 py-1 text-xs ${
                        studioTab === "canvas" ? "bg-white/15 text-foreground shadow" : "text-muted-foreground"
                      }`}
                      onClick={() => setStudioTab("canvas")}
                    >
                      Canvas
                    </button>
                    <button
                      type="button"
                      className={`rounded px-2 py-1 text-xs ${
                        studioTab === "workspace" ? "bg-white/15 text-foreground shadow" : "text-muted-foreground"
                      }`}
                      onClick={() => setStudioTab("workspace")}
                    >
                      Workspace
                    </button>
                  </div>
                </div>

                {studioTab === "canvas" ? (
                  <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant={canvasMode === "markdown" ? "default" : "outline"} onClick={() => setCanvasMode("markdown")}>
                        <PenSquare className="mr-1 h-3.5 w-3.5" /> Markdown
                      </Button>
                      <Button size="sm" variant={canvasMode === "code" ? "default" : "outline"} onClick={() => setCanvasMode("code")}>
                        <Code className="mr-1 h-3.5 w-3.5" /> Code
                      </Button>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-[#11141b] p-2">
                      <div className="mb-2 flex items-center justify-between text-xs font-medium">
                        <div className="flex items-center gap-1">
                          <Layers className="h-3.5 w-3.5" /> Files ({canvasArtifacts.length})
                        </div>
                        <Button size="sm" variant="outline" className="h-7" onClick={addArtifact}>
                          <FilePlus2 className="mr-1 h-3.5 w-3.5" /> Add
                        </Button>
                      </div>

                      <div className="mb-2 flex gap-2">
                        <Input
                          value={newArtifactPath}
                          onChange={(event) => setNewArtifactPath(event.target.value)}
                          placeholder="src/new-file.ts"
                          className="h-8 bg-[#0f131a]"
                        />
                      </div>

                      <select
                        value={activeArtifact?.id ?? ""}
                        onChange={(event) => setActiveArtifactId(event.target.value)}
                        className="h-8 w-full rounded-md border border-white/10 bg-[#0f131a] px-2 text-xs"
                      >
                        {canvasArtifacts.map((artifact) => (
                          <option key={artifact.id} value={artifact.id}>
                            {artifact.path}
                          </option>
                        ))}
                      </select>

                      {activeArtifact ? (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <Input
                            value={activeArtifact.path}
                            onChange={(event) =>
                              updateActiveArtifact((item) => ({ ...item, path: sanitizePath(event.target.value) }))
                            }
                            className="h-8 bg-[#0f131a] text-xs"
                          />
                          <Input
                            value={activeArtifact.language}
                            onChange={(event) => updateActiveArtifact((item) => ({ ...item, language: event.target.value }))}
                            className="h-8 bg-[#0f131a] text-xs"
                          />
                        </div>
                      ) : null}
                    </div>

                    <textarea
                      value={activeArtifact?.content ?? ""}
                      onChange={(event) => updateActiveArtifact((item) => ({ ...item, content: event.target.value }))}
                      placeholder={canvasMode === "markdown" ? "Write your document here" : "Write your code here"}
                      className="min-h-[160px] w-full flex-1 resize-none rounded-md border border-white/10 bg-[#0f131a] p-3 font-mono text-sm outline-none focus:border-white/30"
                    />

                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">Workspace</div>
                        <div className="truncate text-xs text-muted-foreground">{activeWorkspacePath ?? "No workspace selected"}</div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => void handleSelectWorkspace()}>
                        {activeWorkspacePath ? "Change" : "Open"}
                      </Button>
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
                )}

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

  const [workspaceByThreadId, setWorkspaceByThreadId] = useState<Record<string, string>>({});
  const workspaceByThreadIdRef = useRef(workspaceByThreadId);
  useEffect(() => {
    workspaceByThreadIdRef.current = workspaceByThreadId;
  }, [workspaceByThreadId]);

  const streamByRequestIdRef = useRef<Record<string, StreamController>>({});

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

        return (async function* () {
          let streamedText = "";
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
            .then((output) => output)
            .finally(() => {
              streamController.close();
              delete streamByRequestIdRef.current[requestId];
            });

          for await (const delta of streamController.iterator) {
            if (!delta) continue;
            streamedText += delta;
            yield { content: [{ type: "text", text: delta }] };
          }

          const output = await sendPromise;
          if (!streamedText) {
            yield { content: [{ type: "text", text: output }] };
          } else if (output && output.startsWith(streamedText)) {
            const remaining = output.slice(streamedText.length);
            if (remaining) yield { content: [{ type: "text", text: remaining }] };
          } else if (output) {
            yield { content: [{ type: "text", text: output }] };
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
