import type { FC, PropsWithChildren } from "react";
import { Fragment } from "react";
import { MessagePrimitive, type ToolCallMessagePartProps } from "@assistant-ui/react";
import { AssistantActionBar, BranchPicker, makeMarkdownText } from "@assistant-ui/react-ui";
import { useAuiState } from "@assistant-ui/store";
import { getAvatarIcon } from "@/components/avatarIcons";
import { openUrl } from "@tauri-apps/plugin-opener";

type ToolResultJson = Record<string, unknown>;

const extractToolSummary = (toolName: string, argsText?: string) => {
  if (!argsText) return "";
  try {
    const parsed = JSON.parse(argsText);
    if (parsed && typeof parsed === "object") {
      const operation = typeof parsed.operation === "string" ? parsed.operation : undefined;
      const url = typeof parsed.url === "string" ? parsed.url : undefined;
      const path = typeof parsed.path === "string" ? parsed.path : undefined;
      const query = typeof parsed.query === "string" ? parsed.query : undefined;
      const expression = typeof parsed.expression === "string" ? parsed.expression : undefined;

      if (operation && url) return `${operation} • ${url}`;
      if (operation && path) return `${operation} • ${path}`;
      if (path) return path;
      if (query) return query;
      if (expression) return expression;
    }
  } catch {
    // fall through
  }
  return argsText.length > 140 ? `${argsText.slice(0, 140)}…` : argsText;
};

const parseJson = (value?: string): ToolResultJson | null => {
  if (!value || typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as ToolResultJson) : null;
  } catch {
    return null;
  }
};

const formatBytes = (value?: number) => {
  if (!value && value !== 0) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const WebOpCard: FC<{
  args: ToolResultJson | null;
  result: ToolResultJson | null;
}> = ({ args, result }) => {
  const operation = (args?.operation || result?.operation) as string | undefined;
  const url = (args?.url || result?.url || result?.source) as string | undefined;
  const status = result?.status as number | undefined;
  const statusText = result?.statusText as string | undefined;

  const links = Array.isArray(result?.links) ? (result?.links as Array<any>) : null;
  const items = Array.isArray(result?.items) ? (result?.items as Array<any>) : null;
  const text = typeof result?.text === "string" ? (result?.text as string) : null;

  return (
    <div className="rounded-md border border-[var(--surface-border)] bg-panel-card px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-[10px]">
          {operation || "web"}
        </span>
        {url ? <span className="truncate">{url}</span> : null}
        {status ? (
          <span className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-[10px]">
            {status} {statusText ?? ""}
          </span>
        ) : null}
      </div>

      {links ? (
        <div className="mt-2 rounded-md border border-[var(--surface-border-subtle)] bg-[var(--overlay-light)] p-2">
          <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground/70">Links</div>
          <div className="max-h-44 overflow-auto">
            <div className="grid grid-cols-[1fr_2fr] gap-2 text-[11px] text-muted-foreground">
              <div className="text-muted-foreground/70">Text</div>
              <div className="text-muted-foreground/70">URL</div>
              {links.slice(0, 20).map((link, i) => (
                <Fragment key={`${link?.href ?? "link"}-${i}`}>
                  <div className="truncate text-foreground/80">{link?.text || "-"}</div>
                  <div className="truncate">{link?.href || "-"}</div>
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {items ? (
        <div className="mt-2 rounded-md border border-[var(--surface-border-subtle)] bg-[var(--overlay-light)] p-2">
          <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground/70">Items</div>
          <div className="space-y-2 text-[11px] text-muted-foreground">
            {items.slice(0, 5).map((item, i) => (
              <div key={`${item?.link ?? "item"}-${i}`} className="rounded-md border border-[var(--surface-border-subtle)] p-2">
                <div className="truncate text-foreground/80">{item?.title || "Untitled"}</div>
                {item?.link ? <div className="truncate">{item.link}</div> : null}
                {item?.pubDate ? <div className="text-muted-foreground/70">{item.pubDate}</div> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {text ? (
        <div className="mt-2 rounded-md border border-[var(--surface-border-subtle)] bg-[var(--overlay-light)] p-2">
          <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground/70">Excerpt</div>
          <div className="line-clamp-4 text-[11px] text-muted-foreground">
            {text.slice(0, 600)}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const FileSearchCard: FC<{
  result: ToolResultJson | null;
}> = ({ result }) => {
  const files = Array.isArray(result?.files) ? (result?.files as Array<any>) : [];
  const total = typeof result?.total === "number" ? (result?.total as number) : files.length;

  return (
    <div className="rounded-md border border-[var(--surface-border)] bg-panel-card px-3 py-2 text-xs">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>file_search</span>
        <span>{files.length} shown / {total} total</span>
      </div>
      <div className="mt-2 max-h-48 overflow-auto rounded-md border border-[var(--surface-border-subtle)] bg-[var(--overlay-light)] p-2">
        <div className="grid grid-cols-[2fr_80px_140px] gap-2 text-[11px] text-muted-foreground">
          <div className="text-muted-foreground/70">Path</div>
          <div className="text-muted-foreground/70">Size</div>
          <div className="text-muted-foreground/70">Modified</div>
          {files.map((file, i) => (
            <Fragment key={`${file?.path ?? "file"}-${i}`}>
              <div className="truncate text-foreground/80">{file?.path || "-"}</div>
              <div>{formatBytes(file?.size)}</div>
              <div className="truncate">{file?.modified || "-"}</div>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

const SkillTraceCard: FC<{ result: ToolResultJson | null }> = ({ result }) => {
  if (!result) return null;
  const action = result.action as string | undefined;
  const path = result.path as string | undefined;
  const size = typeof result.size === "number" ? result.size : undefined;

  return (
    <div className="rounded-md border border-[var(--surface-border)] bg-panel-card px-3 py-2 text-xs">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>skills</span>
        {action ? <span className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-[10px]">{action}</span> : null}
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        {path ? <div className="truncate">{path}</div> : null}
        {size !== undefined ? <div>Size: {formatBytes(size)}</div> : null}
      </div>
    </div>
  );
};

const ToolGroup: FC<PropsWithChildren<{ startIndex: number; endIndex: number }>> = ({
  children,
  startIndex,
  endIndex,
}) => {
  const parts = useAuiState(({ message }) => message.parts);
  let count = 0;
  for (let i = startIndex; i <= endIndex; i += 1) {
    const part = parts[i] as Partial<ToolCallMessagePartProps> | undefined;
    if (!part || part.type !== "tool-call") continue;
    if (part.toolName !== "skills") {
      count += 1;
      continue;
    }
    const argsText = typeof part.argsText === "string" ? part.argsText : "";
    const resultText =
      typeof part.result === "string" ? part.result : part.result != null ? JSON.stringify(part.result) : "";
    const rawText = `${argsText}\n${resultText}`;
    if (rawText.includes("/skills/user/") || rawText.includes("/skills/project/")) continue;
    count += 1;
  }
  if (count === 0) return null;
  return (
    <details className="my-3 rounded-lg border border-[var(--surface-border)] bg-panel-inset px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
        Tool calls • {count}
      </summary>
      <div className="mt-2 space-y-2">{children}</div>
    </details>
  );
};

const ReasoningGroup: FC<PropsWithChildren<{ startIndex: number; endIndex: number }>> = ({ children }) => {
  return (
    <details className="my-3 rounded-lg border border-dashed border-[var(--surface-border)] bg-panel-base px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
        Reasoning (summarized)
      </summary>
      <div className="mt-2 space-y-2 text-xs text-muted-foreground">
        <div className="text-[11px] text-muted-foreground/80">
          Raw chain-of-thought is hidden. This is a brief, user-facing summary.
        </div>
        {children}
      </div>
    </details>
  );
};

const ToolCallCard: FC<ToolCallMessagePartProps> = ({
  toolName,
  argsText,
  result,
  isError,
  status,
}) => {
  const argsJson = parseJson(argsText);
  const resultText = typeof result === "string" ? result : result != null ? JSON.stringify(result, null, 2) : "";
  const resultJson = parseJson(resultText);

  if (toolName === "skills") {
    const skillPath =
      (typeof resultJson?.path === "string" && (resultJson.path as string)) ||
      (typeof argsJson?.path === "string" && (argsJson.path as string)) ||
      "";
    const rawText = `${argsText ?? ""}\n${resultText ?? ""}`;
    if (
      skillPath.startsWith("/skills/user/") ||
      skillPath.startsWith("/skills/project/") ||
      rawText.includes("/skills/user/") ||
      rawText.includes("/skills/project/")
    ) {
      return null;
    }
  }

  if (toolName === "web_operations") {
    return <WebOpCard args={argsJson} result={resultJson} />;
  }

  if (toolName === "file_search") {
    return <FileSearchCard result={resultJson} />;
  }

  if (toolName === "skills") {
    return <SkillTraceCard result={resultJson} />;
  }

  let renderedResult = "";
  if (result != null) {
    if (typeof result === "string") renderedResult = result;
    else {
      try {
        renderedResult = JSON.stringify(result, null, 2);
      } catch {
        renderedResult = String(result);
      }
    }
  }

  const statusLabel =
    status?.type === "running"
      ? "Running"
      : isError
      ? "Error"
      : result != null
      ? "Done"
      : "Queued";

  const summary = extractToolSummary(toolName, argsText);
  const hasArgs = !!argsText;
  const hasResult = !!renderedResult;
  const argsAndResultSame = hasArgs && hasResult && argsText?.trim() === renderedResult.trim();

  return (
    <details
      className="rounded-md border border-[var(--surface-border)] bg-panel-card px-3 py-2 text-xs"
      open={status?.type === "running" || isError}
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-foreground/80">{toolName}</span>
          {summary ? <span className="truncate text-muted-foreground/80">{summary}</span> : null}
        </div>
        <span className="shrink-0 rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-[10px]">
          {statusLabel}
        </span>
      </summary>

      <div className="mt-2 space-y-2">
        {hasArgs ? (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
              Input
            </div>
            <pre className="whitespace-pre-wrap rounded-md bg-[var(--overlay-medium)] p-2 text-[11px] text-muted-foreground">
              {argsText}
            </pre>
          </div>
        ) : null}
        {hasResult && !argsAndResultSame ? (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
              {isError ? "Error" : "Output"}
            </div>
            <pre className="whitespace-pre-wrap rounded-md bg-[var(--overlay-light)] p-2 text-[11px] text-muted-foreground">
              {renderedResult}
            </pre>
          </div>
        ) : null}
      </div>
    </details>
  );
};

const MarkdownText = makeMarkdownText({
  className: "markdown",
  components: {
    a: ({ href, className, ...props }) => {
      const safeHref = typeof href === "string" && href.trim().length > 0 ? href : null;
      if (!safeHref) {
        return <span className={className} {...props} />;
      }
      return (
        <a
          href={safeHref}
          className={className}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void openUrl(safeHref);
          }}
          {...props}
        />
      );
    },
  },
});

const AssistantMessage: FC = () => {
  const AvatarIcon = getAvatarIcon();

  return (
    <MessagePrimitive.Root className="aui-assistant-message-root">
      <div className="aui-avatar-root aui-assistant-avatar">
        <div className="aui-avatar-fallback text-muted-foreground">
          <AvatarIcon className="h-5 w-5" />
        </div>
      </div>

      <div className="aui-assistant-message-content">
        <MessagePrimitive.Content
          components={{
            Text: MarkdownText,
            tools: { Fallback: ToolCallCard },
            ToolGroup,
            ReasoningGroup,
          }}
        />
      </div>

      <BranchPicker />
      <AssistantActionBar />
    </MessagePrimitive.Root>
  );
};

export { AssistantMessage };
