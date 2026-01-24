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
};

export type WorkspaceEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
};

export type AgentConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
};

export type ChatMessage = {
  role: string;
  content: string;
};
