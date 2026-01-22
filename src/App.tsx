import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChatOpenAI } from "@langchain/openai";
import { open } from "@tauri-apps/plugin-dialog";
import { mkdir, readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  MessageSquare,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { NoopBackend } from "@/lib/agent-backend";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_DEFAULT_MODEL = "openai/gpt-4o-mini";
const SETTINGS_FILENAME = "settings.json";

type Thread = {
  id: string;
  title: string;
  unread: number;
  workspacePath?: string | null;
};

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  timestamp: string;
};

type WorkspaceEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
};

function App() {
  const [threads, setThreads] = useState<Thread[]>([
    { id: "t-1", title: "Welcome", unread: 0, workspacePath: null },
  ]);
  const [activeThreadId, setActiveThreadId] = useState("t-1");
  const [threadQuery, setThreadQuery] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [messagesByThread, setMessagesByThread] = useState<
    Record<string, Message[]>
  >(() => ({
    "t-1": [
      {
        id: "m-1",
        role: "assistant",
        text: "Pick a workspace folder, then start the conversation.",
        timestamp: "Just now",
      },
    ],
  }));
  const [openRouterApiKey, setOpenRouterApiKey] = useState("");
  const [openRouterModel, setOpenRouterModel] = useState(
    OPENROUTER_DEFAULT_MODEL
  );
  const [draftApiKey, setDraftApiKey] = useState("");
  const [draftModel, setDraftModel] = useState(OPENROUTER_DEFAULT_MODEL);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [workspaceEntries, setWorkspaceEntries] = useState<
    Record<string, WorkspaceEntry[]>
  >({});
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>(
    {}
  );
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const baseDir = await appDataDir();
        await mkdir(baseDir, { recursive: true });
        const settingsPath = await join(baseDir, SETTINGS_FILENAME);
        const contents = await readTextFile(settingsPath);
        const parsed = JSON.parse(contents) as {
          openRouterApiKey?: string;
          openRouterModel?: string;
        };
        setOpenRouterApiKey(parsed.openRouterApiKey ?? "");
        setOpenRouterModel(parsed.openRouterModel ?? OPENROUTER_DEFAULT_MODEL);
      } catch {
        setOpenRouterApiKey("");
        setOpenRouterModel(OPENROUTER_DEFAULT_MODEL);
      } finally {
        setSettingsLoaded(true);
      }
    };
    void loadSettings();
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    setDraftApiKey(openRouterApiKey);
    setDraftModel(openRouterModel);
  }, [openRouterApiKey, openRouterModel, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) return;
    const persistSettings = async () => {
      try {
        const baseDir = await appDataDir();
        await mkdir(baseDir, { recursive: true });
        const settingsPath = await join(baseDir, SETTINGS_FILENAME);
        const payload = JSON.stringify(
          { openRouterApiKey, openRouterModel },
          null,
          2
        );
        await writeTextFile(settingsPath, payload);
      } catch {
        return;
      }
    };
    void persistSettings();
  }, [openRouterApiKey, openRouterModel, settingsLoaded]);

  const filteredThreads = useMemo(() => {
    const query = threadQuery.trim().toLowerCase();
    if (!query) return threads;
    return threads.filter((thread) =>
      thread.title.toLowerCase().includes(query)
    );
  }, [threadQuery, threads]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId),
    [activeThreadId, threads]
  );

  const activeMessages = messagesByThread[activeThreadId] ?? [];
  const activeWorkspacePath = activeThread?.workspacePath ?? null;

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
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name);
        }
        return a.isDirectory ? -1 : 1;
      });
      setWorkspaceEntries((prev) => ({ ...prev, [path]: mappedEntries }));
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : "Failed to read folder"
      );
    }
  }, []);

  useEffect(() => {
    if (!activeWorkspacePath) return;
    if (!workspaceEntries[activeWorkspacePath]) {
      loadDirectory(activeWorkspacePath);
    }
    setExpandedPaths((prev) => ({
      ...prev,
      [activeWorkspacePath]: prev[activeWorkspacePath] ?? true,
    }));
  }, [activeWorkspacePath, loadDirectory, workspaceEntries]);

  const handleSelectThread = (threadId: string) => {
    setActiveThreadId(threadId);
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId ? { ...thread, unread: 0 } : thread
      )
    );
  };

  const handleSelectWorkspace = async (threadId: string) => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select workspace folder",
    });
    if (!selected || Array.isArray(selected)) return;
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId
          ? { ...thread, workspacePath: selected }
          : thread
      )
    );
    setExpandedPaths((prev) => ({ ...prev, [selected]: true }));
    await loadDirectory(selected);
  };

  const createThread = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select workspace folder",
    });
    if (!selected || Array.isArray(selected)) return;
    const id = `t-${Date.now()}`;
    const workspaceName = selected.split(/[/\\]/).filter(Boolean).pop();
    const title = workspaceName ? `Thread - ${workspaceName}` : "New thread";
    setThreads((prev) => [
      { id, title, unread: 0, workspacePath: selected },
      ...prev,
    ]);
    setMessagesByThread((prev) => ({
      ...prev,
      [id]: [
        {
          id: `m-${Date.now() + 1}`,
          role: "assistant",
          text: "Workspace loaded. What do you want to build?",
          timestamp: "Just now",
        },
      ],
    }));
    setActiveThreadId(id);
    setExpandedPaths((prev) => ({ ...prev, [selected]: true }));
    await loadDirectory(selected);
  };

  const toggleDirectory = async (path: string) => {
    const isExpanded = !!expandedPaths[path];
    setExpandedPaths((prev) => ({ ...prev, [path]: !isExpanded }));
    if (!isExpanded && !workspaceEntries[path]) {
      await loadDirectory(path);
    }
  };

  const formatMessageContent = (content: unknown) => {
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
  };

  const handleSendMessage = async () => {
    if (isSending) return;
    const trimmed = messageDraft.trim();
    if (!trimmed) return;
    if (!openRouterApiKey || !openRouterModel) {
      setMessagesByThread((prev) => ({
        ...prev,
        [activeThreadId]: [
          ...(prev[activeThreadId] ?? []),
          {
            id: `m-${Date.now()}`,
            role: "system",
            text: "OpenRouter key or model missing. Open settings to configure.",
            timestamp: "Just now",
          },
        ],
      }));
      return;
    }

    const now = new Date();
    const timestamp = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const userMessage: Message = {
      id: `m-${Date.now()}`,
      role: "user",
      text: trimmed,
      timestamp,
    };
    const targetThreadId = activeThreadId;
    const threadMessages = messagesByThread[targetThreadId] ?? [];

    setMessageDraft("");
    setIsSending(true);
    setMessagesByThread((prev) => ({
      ...prev,
      [targetThreadId]: [...(prev[targetThreadId] ?? []), userMessage],
    }));

    try {
      const model = new ChatOpenAI({
        apiKey: openRouterApiKey,
        model: openRouterModel,
        configuration: {
          baseURL: OPENROUTER_BASE_URL,
          dangerouslyAllowBrowser: true,
          defaultHeaders: {
            "HTTP-Referer": "https://ohmycowork.local",
            "X-Title": "Oh My Cowork",
          },
        },
      });

      const { createDeepAgent } = await import("deepagents");
      const agent = createDeepAgent({
        model,
        backend: () => new NoopBackend(),
        systemPrompt: activeWorkspacePath
          ? `You are a helpful coworker assistant. The current workspace root is ${activeWorkspacePath}.`
          : "You are a helpful coworker assistant.",
      });

      const result = await agent.invoke({
        messages: [...threadMessages, userMessage]
          .filter((message) => message.role !== "system")
          .map((message) => ({
            role: message.role,
            content: message.text,
          })),
      });

      const messages = (result as { messages?: Array<{ content?: unknown }> })
        .messages;
      const lastMessage = messages?.[messages.length - 1];
      const assistantText = formatMessageContent(lastMessage?.content);

      setMessagesByThread((prev) => ({
        ...prev,
        [targetThreadId]: [
          ...(prev[targetThreadId] ?? []),
          {
            id: `m-${Date.now() + 1}`,
            role: "assistant",
            text: assistantText || "No response from model.",
            timestamp: "Just now",
          },
        ],
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      setMessagesByThread((prev) => ({
        ...prev,
        [targetThreadId]: [
          ...(prev[targetThreadId] ?? []),
          {
            id: `m-${Date.now() + 1}`,
            role: "system",
            text: `Agent error: ${message}`,
            timestamp: "Just now",
          },
        ],
      }));
    } finally {
      setIsSending(false);
    }
  };

  const renderWorkspaceEntries = (path: string, depth = 0) => {
    const entries = workspaceEntries[path];
    if (!entries) {
      return (
        <div className="py-2 text-xs text-muted-foreground">
          Loading folder...
        </div>
      );
    }

    if (entries.length === 0) {
      return (
        <div className="py-2 text-xs text-muted-foreground">
          Empty folder
        </div>
      );
    }

    return entries.map((entry) => {
      const isExpanded = !!expandedPaths[entry.path];
      const paddingLeft = 12 + depth * 16;

      if (entry.isDirectory) {
        return (
          <div key={entry.path}>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md py-1 text-left text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              style={{ paddingLeft }}
              onClick={() => toggleDirectory(entry.path)}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
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
  };

  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="sidebar">
        <SidebarHeader>
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="text-sm font-semibold">Threads</div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={createThread}
            >
              <Plus className="mr-1 h-4 w-4" />
              New thread
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search threads"
              className="h-8"
              value={threadQuery}
              onChange={(event) => setThreadQuery(event.target.value)}
            />
          </div>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Recent</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredThreads.map((thread) => (
                  <SidebarMenuItem key={thread.id}>
                    <SidebarMenuButton
                      isActive={thread.id === activeThreadId}
                      onClick={() => handleSelectThread(thread.id)}
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>{thread.title}</span>
                    </SidebarMenuButton>
                    {thread.unread > 0 ? (
                      <SidebarMenuBadge>{thread.unread}</SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="flex">
        <div className="flex w-full flex-1 flex-col">
          <header className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <div>
                <div className="text-sm font-semibold">Chat with Model</div>
                <div className="text-xs text-muted-foreground">
                  Thread: {activeThread?.title ?? "Unknown"}
                </div>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              Model: {openRouterModel || "Not configured"}
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
            <Card className="flex min-h-0 flex-1 flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Conversation
                </CardTitle>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col">
                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-4">
                    {activeMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`rounded-lg border p-3 text-sm ${
                          message.role === "user"
                            ? "bg-muted/40"
                            : message.role === "system"
                              ? "border-destructive/40 bg-destructive/10 text-destructive"
                              : "bg-background"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span>
                            {message.role === "user"
                              ? "You"
                              : message.role === "assistant"
                                ? "Assistant"
                                : "System"}
                          </span>
                          <span>{message.timestamp}</span>
                        </div>
                        <div className="mt-2 whitespace-pre-wrap">
                          {message.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Separator />

            <div className="flex items-center gap-2">
              <Input
                placeholder="Type a message..."
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSendMessage();
                  }
                }}
                disabled={isSending}
              />
              <Button onClick={handleSendMessage} disabled={isSending}>
                {isSending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </div>
      </SidebarInset>

      <Sidebar side="right" collapsible="none" variant="sidebar">
        <SidebarHeader>
          <div className="flex items-start justify-between gap-2 px-1">
            <div>
              <div className="text-sm font-semibold">Workspace</div>
              <div className="text-xs text-muted-foreground">
                {activeWorkspacePath ?? "No workspace selected"}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSelectWorkspace(activeThreadId)}
            >
              {activeWorkspacePath ? "Change" : "Open"}
            </Button>
          </div>
          {workspaceError ? (
            <div className="text-xs text-destructive">{workspaceError}</div>
          ) : null}
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Files</SidebarGroupLabel>
            <SidebarGroupContent>
              <ScrollArea className="max-h-[70vh] pr-2">
                {activeWorkspacePath ? (
                  <div className="space-y-1">
                    {renderWorkspaceEntries(activeWorkspacePath)}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Choose a folder to browse its contents.
                  </div>
                )}
              </ScrollArea>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>System settings</DialogTitle>
            <DialogDescription>
              Configure OpenRouter credentials and default model.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium">OpenRouter API Key</label>
              <Input
                type="password"
                value={draftApiKey}
                onChange={(event) => setDraftApiKey(event.target.value)}
                placeholder="sk-or-..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Model</label>
              <Input
                value={draftModel}
                onChange={(event) => setDraftModel(event.target.value)}
                placeholder="openai/gpt-4o-mini"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDraftApiKey(openRouterApiKey);
                setDraftModel(openRouterModel);
                setSettingsOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setOpenRouterApiKey(draftApiKey);
                setOpenRouterModel(draftModel || OPENROUTER_DEFAULT_MODEL);
                setSettingsOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

export default App;
