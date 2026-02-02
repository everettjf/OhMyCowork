/**
 * Shared types for OhMyCowork sidecar tools
 */

export interface ToolContext {
  workspaceRoot?: string;
  requestId?: string;
  emitStatus?: StatusEmitter;
}

export interface StatusEvent {
  stage: "tool_start" | "tool_end" | "tool_error";
  tool: string;
  detail?: unknown;
  requestId?: string;
}

export type StatusEmitter = (event: StatusEvent) => void;

export function createNotifier(
  toolName: string,
  emitStatus?: StatusEmitter,
  requestId?: string
) {
  return (stage: StatusEvent["stage"], detail?: unknown) => {
    if (typeof emitStatus === "function") {
      emitStatus({ stage, tool: toolName, detail, requestId });
    }
  };
}

export function resolveWorkspacePath(
  workspaceRoot: string,
  targetPath: string
): string {
  const path = require("node:path");
  const cleaned = targetPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const absolute = path.resolve(workspaceRoot, cleaned);
  const relative = path.relative(workspaceRoot, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path escapes workspace root.");
  }
  return absolute;
}
