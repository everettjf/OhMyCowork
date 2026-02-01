import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, Wrench } from "lucide-react";
import type { ToolCall } from "@/types";

interface ToolCallCardProps {
  toolCalls: ToolCall[];
}

const toolIcons: Record<string, string> = {
  internet_search: "🔍",
  agent_browser: "🌐",
  get_time: "🕐",
  get_timezone: "🌍",
  random_number: "🎲",
  generate_uuid: "🔑",
  calculate_expression: "🧮",
  run_node: "⚡",
  organize_folder: "📁",
};

function ToolCallItem({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const icon = toolIcons[tool.name] || "🔧";

  const statusIcon = tool.status === "running" ? (
    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
  ) : tool.status === "completed" ? (
    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
  ) : (
    <XCircle className="h-3.5 w-3.5 text-red-500" />
  );

  const hasDetails = tool.args || tool.result || tool.error;

  return (
    <div className="rounded-md border border-border/50 bg-muted/30 overflow-hidden">
      <button
        type="button"
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs ${hasDetails ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
      >
        {hasDetails ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )
        ) : (
          <span className="w-3" />
        )}
        <span className="text-sm">{icon}</span>
        <span className="font-medium text-foreground/90">{tool.name}</span>
        <span className="ml-auto">{statusIcon}</span>
      </button>

      {expanded && hasDetails && (
        <div className="border-t border-border/30 bg-background/50 px-3 py-2 text-xs">
          {tool.args && Object.keys(tool.args).length > 0 && (
            <div className="mb-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Args</div>
              <pre className="text-[11px] bg-muted/40 rounded p-1.5 overflow-x-auto">
                {JSON.stringify(tool.args, null, 2)}
              </pre>
            </div>
          )}
          {tool.result && (
            <div className="mb-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Result</div>
              <pre className="text-[11px] bg-muted/40 rounded p-1.5 overflow-x-auto max-h-32">
                {tool.result.slice(0, 500)}{tool.result.length > 500 ? "..." : ""}
              </pre>
            </div>
          )}
          {tool.error && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-red-500 mb-1">Error</div>
              <pre className="text-[11px] bg-red-500/10 text-red-600 rounded p-1.5 overflow-x-auto">
                {tool.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ToolCallCard({ toolCalls }: ToolCallCardProps) {
  if (!toolCalls || toolCalls.length === 0) return null;

  const runningCount = toolCalls.filter(t => t.status === "running").length;
  const completedCount = toolCalls.filter(t => t.status === "completed").length;
  const errorCount = toolCalls.filter(t => t.status === "error").length;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <Wrench className="h-3 w-3" />
        <span>
          {runningCount > 0 && <span className="text-blue-500">{runningCount} running</span>}
          {runningCount > 0 && (completedCount > 0 || errorCount > 0) && " · "}
          {completedCount > 0 && <span className="text-green-500">{completedCount} completed</span>}
          {completedCount > 0 && errorCount > 0 && " · "}
          {errorCount > 0 && <span className="text-red-500">{errorCount} failed</span>}
        </span>
      </div>
      <div className="space-y-1">
        {toolCalls.map((tool, index) => (
          <ToolCallItem key={`${tool.name}-${index}`} tool={tool} />
        ))}
      </div>
    </div>
  );
}
