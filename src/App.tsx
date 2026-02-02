import { Button } from "@/components/ui/button";
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
import { open as openDialog, confirm } from "@tauri-apps/plugin-dialog";
import { readDir } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Settings,
} from "lucide-react";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import type { Thread, Message, WorkspaceEntry } from "@/types";
import { sendMessage } from "@/services/agent";
import { useSettings } from "@/hooks/useSettings";
import { SkillsPanel } from "@/components/SkillsPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { PROVIDER_PRESETS } from "@/lib/providers";

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

  const { settings, saveSettings } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
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
        permissionNotified: boolean;
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
        if (payload.stage === "permission_error" && !entry.permissionNotified) {
          entry.permissionNotified = true;
          promptWorkspacePermission(entry.threadId);
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

  const promptWorkspacePermission = async (threadId: string) => {
    const confirmed = await confirm(
      "The app needs permission to access this folder. Re-select the workspace to grant access.",
      { title: "Permission required", kind: "warning" }
    );
    if (confirmed) {
      await handleSelectWorkspace(threadId);
    }
  };

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
      const code = error instanceof Error ? (error as { code?: string }).code : undefined;
      if (code === "EACCES" || code === "EPERM") {
        // Re-open the folder picker to re-grant OS access.
        await promptWorkspacePermission(activeThreadId);
      }
      setWorkspaceError(
        error instanceof Error ? error.message : "Failed to read folder"
      );
    }
  }, [activeThreadId]);

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
    const selected = await openDialog({
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
    const selected = await openDialog({
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

  const isLikelyFileOperationRequest = (text: string) => {
    const t = text.toLowerCase();
    return /(file|folder|workspace|path|rename|delete|remove|copy|move|organize|excel|word|powerpoint|pdf|image|video|csv|archive|zip|unzip|文件|文件夹|路径|重命名|删除|拷贝|复制|移动|整理|表格|文档|图片|视频|压缩)/i.test(
      t
    );
  };

  const isLikelyDestructiveDeleteRequest = (text: string) => {
    const t = text.toLowerCase();
    const hasExplicitToolCall = /file_delete|delete_duplicates/.test(t);
    const hasDeleteVerb = /(delete|remove|erase|purge|wipe|删除|清除)/i.test(t);
    const hasFileTarget =
      /(file|folder|directory|path|workspace|duplicate|tmp|log|文件|文件夹|目录|路径|重复)/i.test(t);
    const looksSafePreview =
      /(dry[ -]?run|preview|report only|只预览|仅预览|不删除|仅报告)/i.test(t);

    return (hasExplicitToolCall || (hasDeleteVerb && hasFileTarget)) && !looksSafePreview;
  };

  const handleSendMessage = async () => {
    if (isSending) return;
    const trimmed = messageDraft.trim();
    if (!trimmed) return;

    if (!activeWorkspacePath && isLikelyFileOperationRequest(trimmed)) {
      addMessage(activeThreadId, {
        id: `m-${Date.now()}`,
        role: "system",
        text: "Please provide/select a workspace folder first, then I can run file operations safely.",
        timestamp: "Just now",
      });
      return;
    }

    if (isLikelyDestructiveDeleteRequest(trimmed)) {
      const confirmedDelete = await confirm(
        "This may permanently delete files. Do you want to continue?",
        { title: "Confirm Deletion", kind: "warning" }
      );
      if (!confirmedDelete) {
        addMessage(activeThreadId, {
          id: `m-${Date.now()}`,
          role: "system",
          text: "Deletion request cancelled.",
          timestamp: "Just now",
        });
        return;
      }
    }

    const providerConfig = settings.providers[settings.activeProvider];
    if (!providerConfig?.apiKey || !providerConfig?.model) {
      addMessage(activeThreadId, {
        id: `m-${Date.now()}`,
        role: "system",
        text: "Provider API key or model missing. Open settings to configure.",
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
      permissionNotified: false,
    };

    try {
      const chatMessages = [...threadMessages, userMessage]
        .filter((msg) => msg.role !== "system")
        .map((msg) => ({ role: msg.role, content: msg.text }));

      const response = await sendMessage(
        {
          provider: settings.activeProvider,
          apiKey: providerConfig.apiKey,
          model: providerConfig.model,
          baseUrl: providerConfig.baseUrl,
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

  const handleSaveSettings = async (nextSettings: typeof settings) => {
    const success = await saveSettings(nextSettings);
    if (success) setSettingsOpen(false);
    return success;
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
    <SidebarProvider defaultOpen className="h-svh overflow-hidden">
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
        <SidebarContent className="overflow-hidden">
          <ScrollArea className="flex-1 px-1">
            <SidebarGroup className="min-h-0 flex-1">
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
          </ScrollArea>
        </SidebarContent>
        <SidebarFooter>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => setSkillsOpen(true)}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Skills
          </Button>
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

      <SidebarInset className="flex min-h-0 overflow-hidden">
        <div className="flex w-full min-h-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur">
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
              Provider: {settings.activeProvider} · Model: {settings.providers[settings.activeProvider]?.model || "Not configured"}
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-3 bg-gradient-to-b from-background via-background to-muted/30 p-3">
            <ScrollArea className="min-h-0 flex-1 pr-3">
              <div className="space-y-3 pb-1">
                {activeMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-lg border p-3 text-sm shadow-sm ${
                      message.role === "user"
                        ? "border-muted/70 bg-muted/50"
                        : message.role === "system"
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : "border-border/60 bg-background"
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
                        <div className="markdown">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              a: ({ href, children }) => {
                                const safeHref = typeof href === "string" ? href : "";
                                return (
                                  <a
                                    href={safeHref}
                                    className="underline underline-offset-2 decoration-muted-foreground/60"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      if (!safeHref) return;
                                      Promise.resolve(openUrl(safeHref)).catch(() => {
                                        window.open(safeHref, "_blank", "noopener,noreferrer");
                                      });
                                    }}
                                  >
                                    {children}
                                  </a>
                                );
                              },
                              code: ({ inline, className, children, ...props }: any) => {
                                if (inline) {
                                  return (
                                    <code
                                      className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[12px]"
                                      {...props}
                                    >
                                      {children}
                                    </code>
                                  );
                                }
                                return (
                                  <ScrollArea className="max-h-64 rounded-md border border-border/70 bg-muted/40">
                                    <pre className="p-3 text-xs leading-relaxed">
                                      <code className={`font-mono ${className ?? ""}`} {...props}>
                                        {children}
                                      </code>
                                    </pre>
                                  </ScrollArea>
                                );
                              },
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-2 border-primary/40 pl-3 text-muted-foreground">
                                  {children}
                                </blockquote>
                              ),
                              table: ({ children }) => (
                                <div className="w-full overflow-auto">
                                  <table className="w-full border-collapse text-left text-xs">
                                    {children}
                                  </table>
                                </div>
                              ),
                            }}
                          >
                            {message.text}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{message.text}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

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

      <Sidebar
        side="right"
        collapsible="none"
        variant="sidebar"
        className="sticky top-0 h-svh border-l border-sidebar-border bg-sidebar/95"
      >
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
        <SidebarContent className="overflow-hidden">
          <SidebarGroup className="min-h-0 flex-1">
            <SidebarGroupLabel>Files</SidebarGroupLabel>
            <SidebarGroupContent className="min-h-0">
              <ScrollArea className="h-full pr-2">
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

      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        providers={PROVIDER_PRESETS}
        onSave={handleSaveSettings}
      />
      <SkillsPanel
        open={skillsOpen}
        onOpenChange={setSkillsOpen}
        workspacePath={activeWorkspacePath}
      />
    </SidebarProvider>
  );
}

export default App;
