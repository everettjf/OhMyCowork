import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
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
import { Folder, MessageSquare, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

function App() {
  const [threads, setThreads] = useState([
    { id: "t-1", title: "Product spec draft", unread: 2 },
    { id: "t-2", title: "Bug triage notes", unread: 0 },
    { id: "t-3", title: "Onboarding Q&A", unread: 5 },
    { id: "t-4", title: "Design review", unread: 0 },
  ]);
  const [folders, setFolders] = useState([
    { id: "f-1", name: "Personal", count: 12 },
    { id: "f-2", name: "Work", count: 34 },
    { id: "f-3", name: "Archive", count: 9 },
  ]);
  const [activeThreadId, setActiveThreadId] = useState("t-1");
  const [threadQuery, setThreadQuery] = useState("");
  const [folderQuery, setFolderQuery] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [messagesByThread, setMessagesByThread] = useState(() => ({
    "t-1": [
      {
        id: "m-1",
        role: "user",
        text: "Draft a feature overview for our next release.",
        timestamp: "09:18",
      },
      {
        id: "m-2",
        role: "assistant",
        text: "Sure. I’ll outline goals, key flows, and a brief timeline.",
        timestamp: "09:18",
      },
      {
        id: "m-3",
        role: "user",
        text: "Include risks and open questions too.",
        timestamp: "09:19",
      },
      {
        id: "m-4",
        role: "assistant",
        text: "Noted. I’ll add a risk matrix and unanswered items.",
        timestamp: "09:19",
      },
    ],
    "t-2": [
      {
        id: "m-5",
        role: "user",
        text: "Can we bundle the login fix with the next patch?",
        timestamp: "昨天",
      },
      {
        id: "m-6",
        role: "assistant",
        text: "Yes, as long as QA clears it today.",
        timestamp: "昨天",
      },
    ],
    "t-3": [
      {
        id: "m-7",
        role: "user",
        text: "What should new hires read first?",
        timestamp: "周一",
      },
      {
        id: "m-8",
        role: "assistant",
        text: "Start with the roadmap and the engineering playbook.",
        timestamp: "周一",
      },
    ],
    "t-4": [
      {
        id: "m-9",
        role: "user",
        text: "Please review the new empty state comps.",
        timestamp: "周二",
      },
    ],
  }));
  const activeThreadIdRef = useRef(activeThreadId);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  const filteredThreads = useMemo(() => {
    const query = threadQuery.trim().toLowerCase();
    if (!query) return threads;
    return threads.filter((thread) =>
      thread.title.toLowerCase().includes(query)
    );
  }, [threadQuery, threads]);

  const filteredFolders = useMemo(() => {
    const query = folderQuery.trim().toLowerCase();
    if (!query) return folders;
    return folders.filter((folder) =>
      folder.name.toLowerCase().includes(query)
    );
  }, [folderQuery, folders]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId),
    [activeThreadId, threads]
  );

  const activeMessages = messagesByThread[activeThreadId] ?? [];

  const createThread = (title: string) => {
    const id = `t-${Date.now()}`;
    setThreads((prev) => [{ id, title, unread: 0 }, ...prev]);
    setMessagesByThread((prev) => ({
      ...prev,
      [id]: [
        {
          id: `m-${Date.now() + 1}`,
          role: "assistant",
          text: "New thread is ready. What should we work on?",
          timestamp: "刚刚",
        },
      ],
    }));
    setActiveThreadId(id);
  };

  const handleSelectThread = (threadId: string) => {
    setActiveThreadId(threadId);
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId ? { ...thread, unread: 0 } : thread
      )
    );
  };

  const handleSendMessage = () => {
    const trimmed = messageDraft.trim();
    if (!trimmed) return;
    const targetThreadId = activeThreadId;
    const now = new Date();
    const timestamp = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const userMessage = {
      id: `m-${Date.now()}`,
      role: "user",
      text: trimmed,
      timestamp,
    };

    setMessageDraft("");
    setMessagesByThread((prev) => ({
      ...prev,
      [targetThreadId]: [...(prev[targetThreadId] ?? []), userMessage],
    }));

    const replies = [
      "Got it. I’ll take a first pass and share a draft.",
      "Understood. I can prototype that flow next.",
      "Thanks! I’ll add that to the plan and follow up.",
      "Sounds good. I’ll sync with the team and report back.",
    ];
    const replyText = replies[Math.floor(Math.random() * replies.length)];

    setTimeout(() => {
      const replyMessage = {
        id: `m-${Date.now() + 2}`,
        role: "assistant",
        text: replyText,
        timestamp: "刚刚",
      };
      setMessagesByThread((prev) => ({
        ...prev,
        [targetThreadId]: [...(prev[targetThreadId] ?? []), replyMessage],
      }));
      setThreads((prev) =>
        prev.map((thread) => {
          if (thread.id !== targetThreadId) return thread;
          if (activeThreadIdRef.current === targetThreadId) {
            return { ...thread, unread: 0 };
          }
          return { ...thread, unread: thread.unread + 1 };
        })
      );
    }, 600);
  };

  const handleCreateFolder = () => {
    const id = `f-${Date.now()}`;
    setFolders((prev) => [
      { id, name: `New folder ${prev.length + 1}`, count: 0 },
      ...prev,
    ]);
  };

  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="sidebar">
        <SidebarHeader>
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="text-sm font-semibold">Threads</div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => createThread("Untitled thread")}
            >
              <Plus className="h-4 w-4" />
              <span className="sr-only">New thread</span>
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => createThread("New chat")}
            >
              New chat
            </Button>
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
                            : "bg-background"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span>
                            {message.role === "user" ? "You" : "Assistant"}
                          </span>
                          <span>{message.timestamp}</span>
                        </div>
                        <div className="mt-2">{message.text}</div>
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
              />
              <Button onClick={handleSendMessage}>Send</Button>
            </div>
          </div>
        </div>
      </SidebarInset>

      <Sidebar side="right" collapsible="none" variant="sidebar">
        <SidebarHeader>
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="text-sm font-semibold">Folders</div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={handleCreateFolder}
            >
              <Plus className="h-4 w-4" />
              <span className="sr-only">New folder</span>
            </Button>
          </div>
          <Input
            placeholder="Filter folders"
            className="h-8"
            value={folderQuery}
            onChange={(event) => setFolderQuery(event.target.value)}
          />
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Library</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredFolders.map((folder) => (
                  <SidebarMenuItem key={folder.id}>
                    <SidebarMenuButton>
                      <Folder className="h-4 w-4" />
                      <span>{folder.name}</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge>{folder.count}</SidebarMenuBadge>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}

export default App;
