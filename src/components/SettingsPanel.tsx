import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Key,
  Cpu,
  Globe,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: {
    apiKey: string;
    model: string;
    tavilyApiKey: string;
  };
  onSave: (settings: {
    apiKey: string;
    model: string;
    tavilyApiKey: string;
    provider: string;
  }) => Promise<boolean>;
}

// OpenRouter models - the sidecar uses OpenRouter as the unified API gateway
const OPENROUTER_MODELS = [
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI", description: "Most capable GPT-4 model" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", description: "Fast and affordable" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic", description: "Best for coding" },
  { id: "anthropic/claude-3-opus", name: "Claude 3 Opus", provider: "Anthropic", description: "Most powerful Claude" },
  { id: "google/gemini-pro-1.5", name: "Gemini Pro 1.5", provider: "Google", description: "Google's best model" },
  { id: "meta-llama/llama-3.1-405b-instruct", name: "Llama 3.1 405B", provider: "Meta", description: "Open source powerhouse" },
  { id: "meta-llama/llama-3.1-70b-instruct", name: "Llama 3.1 70B", provider: "Meta", description: "Fast open source" },
  { id: "deepseek/deepseek-chat", name: "DeepSeek Chat", provider: "DeepSeek", description: "Cost-effective alternative" },
  { id: "mistralai/mistral-large", name: "Mistral Large", provider: "Mistral", description: "Powerful European model" },
  { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B", provider: "Alibaba", description: "Leading Chinese model" },
];

export function SettingsPanel({ open, onOpenChange, settings, onSave }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState("providers");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [tavilyApiKey, setTavilyApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setApiKey(settings.apiKey || "");
      setModel(settings.model || "openai/gpt-4o-mini");
      setTavilyApiKey(settings.tavilyApiKey || "");
      setError(null);
    }
  }, [open, settings]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    if (!apiKey.trim()) {
      setError("Please enter your OpenRouter API key");
      setSaving(false);
      return;
    }

    if (!model) {
      setError("Please select a model");
      setSaving(false);
      return;
    }

    try {
      const success = await onSave({
        apiKey: apiKey.trim(),
        model,
        tavilyApiKey: tavilyApiKey.trim(),
        provider: "openrouter",
      });
      if (success) {
        onOpenChange(false);
      } else {
        setError("Failed to save settings");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const selectedModel = OPENROUTER_MODELS.find(m => m.id === model);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl h-[550px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Configure your API credentials and select a model.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="providers" className="gap-1.5">
              <Cpu className="h-3.5 w-3.5" />
              Model
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              Integrations
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4 pr-4">
            <TabsContent value="providers" className="mt-0 space-y-5 min-h-[300px]">
              {/* OpenRouter API Key */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">OpenRouter API Key</label>
                  <a
                    href="https://openrouter.ai/settings/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Get API Key
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Input
                  type="password"
                  placeholder="sk-or-v1-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  OpenRouter provides unified access to GPT-4, Claude, Gemini, Llama, and more.
                </p>
              </div>

              {/* Model Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Model</label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model">
                      {selectedModel && (
                        <div className="flex items-center gap-2">
                          <span>{selectedModel.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({selectedModel.provider})
                          </span>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {OPENROUTER_MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span>{m.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {m.provider}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {m.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="integrations" className="mt-0 space-y-4 min-h-[300px]">
              <div className="rounded-lg border border-border/60 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">Tavily Search</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Enable web search capabilities for the AI agent
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">API Key</label>
                    <a
                      href="https://tavily.com"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Get API Key
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <Input
                    type="password"
                    placeholder="tvly-..."
                    value={tavilyApiKey}
                    onChange={(e) => setTavilyApiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional. Required for internet search functionality.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Key className="h-4 w-4" />
                  More integrations coming soon...
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
