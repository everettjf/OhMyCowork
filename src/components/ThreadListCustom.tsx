import { useEffect, useState } from "react";
import { PlusIcon, ArchiveIcon, Pencil, Download, Trash2 } from "lucide-react";
import { ThreadListPrimitive, ThreadListItemPrimitive, useAui, useAuiState } from "@assistant-ui/react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { formatThreadHistoryMarkdown, loadThreadHistory } from "@/lib/threadHistory";

type ContextMenuState = {
  x: number;
  y: number;
  threadId: string;
  title: string;
} | null;

const sanitizeFileName = (value: string) =>
  value.replace(/[\\/:*?"<>|]+/g, "").trim() || "thread";

const ThreadListItemCustom = ({ onContextMenu }: { onContextMenu: (event: React.MouseEvent, threadId: string, title: string) => void }) => {
  const title = useAuiState(({ threadListItem }) => threadListItem.title ?? "New Chat");
  const threadId = useAuiState(({ threadListItem }) => threadListItem.remoteId ?? threadListItem.id);

  return (
    <ThreadListItemPrimitive.Root className="aui-thread-list-item">
      <ThreadListItemPrimitive.Trigger
        className="aui-thread-list-item-trigger"
        onContextMenu={(event) => onContextMenu(event, threadId, title)}
      >
        <p className="aui-thread-list-item-title">
          <ThreadListItemPrimitive.Title fallback="New Chat" />
        </p>
      </ThreadListItemPrimitive.Trigger>
      <ThreadListItemPrimitive.Archive asChild>
        <button className="aui-thread-list-item-archive" type="button" title="Archive thread">
          <ArchiveIcon className="h-3.5 w-3.5" />
        </button>
      </ThreadListItemPrimitive.Archive>
    </ThreadListItemPrimitive.Root>
  );
};

export const ThreadListCustom = () => {
  const aui = useAui();
  const [menu, setMenu] = useState<ContextMenuState>(null);

  const closeMenu = () => setMenu(null);

  const handleContextMenu = (event: React.MouseEvent, threadId: string, title: string) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, threadId, title });
  };

  const handleRename = async () => {
    if (!menu) return;
    const next = window.prompt("Rename thread", menu.title);
    closeMenu();
    if (!next || !next.trim()) return;
    await aui.threads().item({ id: menu.threadId }).rename(next.trim());
  };

  const handleExport = async () => {
    if (!menu) return;
    const repo = await loadThreadHistory(menu.threadId);
    const markdown = formatThreadHistoryMarkdown(repo, menu.title);
    const fileName = `${sanitizeFileName(menu.title)}.md`;
    const selected = await saveDialog({
      title: "Export chat history",
      defaultPath: fileName,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    closeMenu();
    if (!selected) return;
    await writeTextFile(selected, markdown);
  };

  const handleDelete = async () => {
    closeMenu();
    await aui.threads().item({ id: menu.threadId }).delete();
  };

  useEffect(() => {
    if (!menu) return;
    const handleClick = () => closeMenu();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [menu]);

  return (
    <>
      <ThreadListPrimitive.Root className="aui-root aui-thread-list-root">
        <ThreadListPrimitive.New asChild>
          <button className="aui-thread-list-new" type="button">
            <PlusIcon className="h-4 w-4" />
            New Thread
          </button>
        </ThreadListPrimitive.New>
        <ThreadListPrimitive.Items components={{ ThreadListItem: () => <ThreadListItemCustom onContextMenu={handleContextMenu} /> }} />
      </ThreadListPrimitive.Root>

      {menu ? (
        <div
          className="fixed z-50 min-w-[180px] rounded-md border border-[var(--surface-border)] bg-panel-card shadow-lg"
          style={{ left: menu.x, top: menu.y }}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-muted/60"
            onClick={() => void handleRename()}
          >
            <Pencil className="h-3.5 w-3.5" />
            Rename
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-muted/60"
            onClick={() => void handleExport()}
          >
            <Download className="h-3.5 w-3.5" />
            Export Markdown
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-500 hover:bg-red-500/10"
            onClick={() => void handleDelete()}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      ) : null}
    </>
  );
};
