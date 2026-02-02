export const PROVIDER_IDS = [
  "openrouter",
  "openai",
  "groq",
  "together",
  "fireworks",
  "deepseek",
  "mistral",
  "perplexity",
  "xai",
  "moonshot",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export type ProviderPreset = {
  id: ProviderId;
  name: string;
  docsUrl: string;
  defaultModel: string;
  defaultBaseUrl: string;
};

export const DEFAULT_PROVIDER_ID: ProviderId = "openrouter";

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    docsUrl: "https://openrouter.ai/docs",
    defaultModel: "openai/gpt-4o-mini",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
  },
  {
    id: "openai",
    name: "OpenAI",
    docsUrl: "https://platform.openai.com/docs",
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: "https://api.openai.com/v1",
  },
  {
    id: "groq",
    name: "Groq",
    docsUrl: "https://console.groq.com/docs/openai",
    defaultModel: "llama-3.3-70b-versatile",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
  },
  {
    id: "together",
    name: "Together",
    docsUrl: "https://docs.together.ai/docs/openai-api-compatibility",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    defaultBaseUrl: "https://api.together.xyz/v1",
  },
  {
    id: "fireworks",
    name: "Fireworks",
    docsUrl: "https://docs.fireworks.ai/api-reference/post-chatcompletions",
    defaultModel: "accounts/fireworks/models/llama-v3p1-70b-instruct",
    defaultBaseUrl: "https://api.fireworks.ai/inference/v1",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    docsUrl: "https://api-docs.deepseek.com/",
    defaultModel: "deepseek-chat",
    defaultBaseUrl: "https://api.deepseek.com/v1",
  },
  {
    id: "mistral",
    name: "Mistral",
    docsUrl: "https://docs.mistral.ai/api/",
    defaultModel: "mistral-small-latest",
    defaultBaseUrl: "https://api.mistral.ai/v1",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    docsUrl: "https://docs.perplexity.ai/",
    defaultModel: "sonar",
    defaultBaseUrl: "https://api.perplexity.ai",
  },
  {
    id: "xai",
    name: "xAI",
    docsUrl: "https://docs.x.ai/",
    defaultModel: "grok-2-latest",
    defaultBaseUrl: "https://api.x.ai/v1",
  },
  {
    id: "moonshot",
    name: "Moonshot (Kimi)",
    docsUrl: "https://platform.moonshot.ai/docs",
    defaultModel: "moonshot-v1-8k",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
  },
];

export type ProviderConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
};

export function createDefaultProviderConfigs(): Record<ProviderId, ProviderConfig> {
  return PROVIDER_PRESETS.reduce((acc, preset) => {
    acc[preset.id] = {
      apiKey: "",
      model: preset.defaultModel,
      baseUrl: preset.defaultBaseUrl,
    };
    return acc;
  }, {} as Record<ProviderId, ProviderConfig>);
}
