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
import { open } from "@tauri-apps/plugin-dialog";
import { readDir } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { listen } from "@tauri-apps/api/event";
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
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import type { Thread, Message, WorkspaceEntry } from "@/types";
import { sendMessage } from "@/services/agent";
import { useSettings, DEFAULT_SETTINGS } from "@/hooks/useSettings";

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

  const { settings, loaded: settingsLoaded, error: settingsError, saveSettings, clearError } = useSettings();
  const [draftApiKey, setDraftApiKey] = useState("");
  const [draftModel, setDraftModel] = useState(DEFAULT_SETTINGS.model);
  const [draftTavilyApiKey, setDraftTavilyApiKey] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [workspaceEntries, setWorkspaceEntries] = useState<
    Record<string, WorkspaceEntry[]>
  >({});
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const messageInputRef = useRef<HTMLInputElement>(null);
  const pendingByRequestIdRef = useRef<
    Record<
      string,
      {
        threadId: string;
        messageId: string;
        tools: string[];
      }
    >
  >({});

  const updateMessage = useCallback(
    (
      threadId: string,
      messageId: string,
      updater: (message: Message) => Partial<Message>
    ) => {
      setMessagesByThread((prev) => ({
        ...prev,
        [threadId]: (prev[threadId] ?? []).map((message) =>
          message.id === messageId
            ? { ...message, ...updater(message) }
            : message
        ),
      }));
    },
    []
  );

  useEffect(() => {
    messageInputRef.current?.focus();
  }, [updateMessage]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const startListening = async () => {
      unlisten = await listen("agent:status", (event) => {
        const payload = event.payload as {
          requestId?: string | null;
          stage?: string | null;
          tool?: string | null;
          detail?: Record<string, unknown> | null;
        };
        const requestId = payload?.requestId;
        if (!requestId) return;
        const entry = pendingByRequestIdRef.current[requestId];
        if (!entry) return;

        if (payload.stage === "tool_start") {
          const tool = payload.tool ?? "tool";
          const query =
            typeof payload.detail?.query === "string"
              ? payload.detail.query
              : null;
          const label = query ? `${tool} (query: ${query})` : tool;
          entry.tools.push(label);
        } else if (payload.stage === "tool_error") {
          const tool = payload.tool ?? "tool";
          const status =
            typeof payload.detail?.status === "number"
              ? ` (error: ${payload.detail.status})`
              : " (error)";
          entry.tools.push(`${tool}${status}`);
        }

        const statusText =
          entry.tools.length > 0
            ? `Tools:\n${entry.tools.map((item) => `- ${item}`).join("\n")}`
            : "";
        updateMessage(entry.threadId, entry.messageId, () => ({
          text: statusText,
        }));
      });
    };

    startListening();
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    setDraftApiKey(settings.apiKey);
    setDraftModel(settings.model);
    setDraftTavilyApiKey(settings.tavilyApiKey);
  }, [settings, settingsLoaded]);

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
        thread.id === threadId ? { ...thread, workspacePath: selected } : thread
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

  const addMessage = (threadId: string, message: Message) => {
    setMessagesByThread((prev) => ({
      ...prev,
      [threadId]: [...(prev[threadId] ?? []), message],
    }));
  };

  const handleSendMessage = async () => {
    if (isSending) return;
    const trimmed = messageDraft.trim();
    if (!trimmed) return;

    if (!settings.apiKey || !settings.model) {
      addMessage(activeThreadId, {
        id: `m-${Date.now()}`,
        role: "system",
        text: "OpenRouter key or model missing. Open settings to configure.",
        timestamp: "Just now",
      });
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
    const pendingMessage: Message = {
      id: `m-${Date.now() + 1}`,
      role: "assistant",
      text: "",
      timestamp: "Just now",
      status: "pending",
    };
    const targetThreadId = activeThreadId;
    const threadMessages = messagesByThread[targetThreadId] ?? [];
    const requestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `req-${Date.now()}`;

    setMessageDraft("");
    setIsSending(true);
    addMessage(targetThreadId, userMessage);
    addMessage(targetThreadId, pendingMessage);
    pendingByRequestIdRef.current[requestId] = {
      threadId: targetThreadId,
      messageId: pendingMessage.id,
      tools: [],
    };

    try {
      const chatMessages = [...threadMessages, userMessage]
        .filter((msg) => msg.role !== "system")
        .map((msg) => ({ role: msg.role, content: msg.text }));

      const response = await sendMessage(
        {
          apiKey: settings.apiKey,
          model: settings.model,
          tavilyApiKey: settings.tavilyApiKey,
        },
        chatMessages,
        requestId,
        activeWorkspacePath
      );

      updateMessage(targetThreadId, pendingMessage.id, () => ({
        role: "assistant",
        text: response,
        timestamp: "Just now",
        status: undefined,
      }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : JSON.stringify(error);
      updateMessage(targetThreadId, pendingMessage.id, () => ({
        role: "system",
        text: `Agent error: ${message}`,
        timestamp: "Just now",
        status: undefined,
      }));
    } finally {
      delete pendingByRequestIdRef.current[requestId];
      setIsSending(false);
    }
  };

  const handleSaveSettings = async () => {
    const success = await saveSettings({
      apiKey: draftApiKey,
      model: draftModel,
      tavilyApiKey: draftTavilyApiKey,
    });
    if (success) {
      setSettingsOpen(false);
    }
  };

  const handleCancelSettings = () => {
    setDraftApiKey(settings.apiKey);
    setDraftModel(settings.model);
    setDraftTavilyApiKey(settings.tavilyApiKey);
    clearError();
    setSettingsOpen(false);
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
        <div className="py-2 text-xs text-muted-foreground">Empty folder</div>
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
              Model: {settings.model || "Not configured"}
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
                        <div className="mt-2">
                          {message.status === "pending" ? (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span
                                className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
                                aria-label="Processing"
                              />
                            </div>
                          ) : null}
                          {message.role === "assistant" ? (
                            <ReactMarkdown
                              remarkPlugins={[remarkMath]}
                              rehypePlugins={[rehypeKatex]}
                            >
                              {message.text}
                            </ReactMarkdown>
                          ) : (
                            <div className="whitespace-pre-wrap">{message.text}</div>
                          )}
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
                ref={messageInputRef}
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
                {isSending ? "Processing..." : "Send"}
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
              Configure API credentials and default model.
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
              <div className="text-xs text-muted-foreground">
                Get your key at{" "}
                <a
                  className="underline underline-offset-2"
                  href="https://openrouter.ai/settings/keys"
                  target="_blank"
                  rel="noreferrer"
                >
                  https://openrouter.ai/settings/keys
                </a>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium">Model</label>
                <a
                  className="text-xs text-muted-foreground underline underline-offset-2"
                  href="https://openrouter.ai/models"
                  target="_blank"
                  rel="noreferrer"
                >
                  https://openrouter.ai/models
                </a>
              </div>
              <Input
                value={draftModel}
                onChange={(event) => setDraftModel(event.target.value)}
                placeholder="openai/gpt-4o-mini"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Tavily API Key (for web search)</label>
              <Input
                type="password"
                value={draftTavilyApiKey}
                onChange={(event) => setDraftTavilyApiKey(event.target.value)}
                placeholder="tvly-..."
              />
            </div>
            {settingsError ? (
              <div className="text-xs text-destructive">{settingsError}</div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelSettings}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

export default App;
