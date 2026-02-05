import type { FC, PropsWithChildren } from "react";
import { MessagePrimitive, type ToolCallMessagePartProps } from "@assistant-ui/react";
import { AssistantActionBar, BranchPicker, MessagePart } from "@assistant-ui/react-ui";

const ToolGroup: FC<PropsWithChildren<{ startIndex: number; endIndex: number }>> = ({
  children,
  startIndex,
  endIndex,
}) => {
  const count = endIndex - startIndex + 1;
  return (
    <details className="my-3 rounded-lg border border-white/10 bg-[#0f131a] px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
        Tool calls ({count})
      </summary>
      <div className="mt-2 space-y-2">{children}</div>
    </details>
  );
};

const ReasoningGroup: FC<PropsWithChildren<{ startIndex: number; endIndex: number }>> = ({ children }) => {
  return (
    <details className="my-3 rounded-lg border border-dashed border-white/10 bg-[#0f1117] px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Thinking</summary>
      <div className="mt-2 space-y-2 text-xs text-muted-foreground">{children}</div>
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

  return (
    <div className="rounded-md border border-white/10 bg-[#0b0d12] px-3 py-2 text-xs">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{toolName}</span>
        <span>{statusLabel}</span>
      </div>
      {argsText ? (
        <pre className="mt-2 whitespace-pre-wrap rounded-md bg-black/40 p-2 text-[11px] text-muted-foreground">
          {argsText}
        </pre>
      ) : null}
      {renderedResult ? (
        <pre className="mt-2 whitespace-pre-wrap rounded-md bg-black/30 p-2 text-[11px] text-muted-foreground">
          {renderedResult}
        </pre>
      ) : null}
    </div>
  );
};

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="aui-assistant-message-root">
      <div className="aui-avatar-root aui-assistant-avatar">
        <div className="aui-avatar-fallback text-xs font-semibold text-muted-foreground">A</div>
      </div>

      <div className="aui-assistant-message-content">
        <MessagePrimitive.Content
          components={{
            Text: MessagePart.Markdown,
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
