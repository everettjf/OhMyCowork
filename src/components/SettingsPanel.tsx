import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, ExternalLink, AlertCircle } from "lucide-react";

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: {
    apiKey: string;
    model: string;
  };
  onSave: (settings: {
    apiKey: string;
    model: string;
    provider: string;
  }) => Promise<boolean>;
}

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
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setApiKey(settings.apiKey || "");
    setModel(settings.model || "openai/gpt-4o-mini");
    setError(null);
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
        provider: "openrouter",
      });
      if (success) onOpenChange(false);
      else setError("Failed to save settings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const selectedModel = OPENROUTER_MODELS.find((m) => m.id === model);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Settings
          </DialogTitle>
          <DialogDescription>Configure your API credentials and select a model.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
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
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Model</label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select a model">
                  {selectedModel && (
                    <div className="flex items-center gap-2">
                      <span>{selectedModel.name}</span>
                      <span className="text-xs text-muted-foreground">({selectedModel.provider})</span>
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
                      <span className="text-xs text-muted-foreground">{m.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
        </div>
      </DialogContent>
    </Dialog>
  );
}
