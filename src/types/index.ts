export type Thread = {
  id: string;
  title: string;
  unread: number;
  workspacePath?: string | null;
};

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  timestamp: string;
  status?: "pending";
  toolCalls?: ToolCall[];
};

export type WorkspaceEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
};

export type Skill = {
  id: string;
  name: string;
  description: string;
  category: "bundled" | "managed" | "workspace";
  enabled: boolean;
  version?: string;
  author?: string;
};

export type ToolCall = {
  name: string;
  status: "running" | "completed" | "error";
  args?: Record<string, unknown>;
  result?: string;
  error?: string;
};
