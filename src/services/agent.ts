import { ProviderId } from "@/lib/providers";
import { invoke } from "@tauri-apps/api/core";

export type ChatMessage = {
  role: string;
  content: string;
};

export type AgentConfig = {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string;
};

export async function sendMessage(
  config: AgentConfig,
  messages: ChatMessage[],
  requestId: string,
  workspacePath?: string | null
): Promise<string> {
  return invoke<string>("send_message", {
    provider: config.provider,
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: config.baseUrl ?? null,
    messages,
    workspacePath: workspacePath ?? null,
    requestId,
  });
}

export async function pingSidecar(): Promise<string> {
  return invoke<string>("ping_sidecar");
}

export async function warmupModel(config: AgentConfig): Promise<string> {
  return invoke<string>("warmup_model", {
    provider: config.provider,
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: config.baseUrl ?? null,
  });
}
