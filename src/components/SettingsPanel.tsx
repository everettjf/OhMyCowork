import { useMemo, useState, useEffect } from "react";
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
import { AlertCircle, ExternalLink, KeyRound, Cpu, Link2, ArrowLeft } from "lucide-react";
import { ProviderId, ProviderPreset, PROVIDER_PRESETS } from "@/lib/providers";
import { Settings } from "@/hooks/useSettings";

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  providers?: ProviderPreset[];
  onSave: (settings: Settings) => Promise<boolean>;
}

export function SettingsPanel({
  open,
  onOpenChange,
  settings,
  providers = PROVIDER_PRESETS,
  onSave,
}: SettingsPanelProps) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(settings);
      setError(null);
    }
  }, [open, settings]);

  const activeProvider = draft.activeProvider;
  const activePreset = useMemo(
    () => providers.find((p) => p.id === activeProvider),
    [providers, activeProvider]
  );
  const activeConfig = draft.providers[activeProvider];

  const configuredCount = useMemo(
    () => providers.filter((p) => (draft.providers[p.id]?.apiKey || "").trim().length > 0).length,
    [providers, draft.providers]
  );

  const navItems = [
    "General",
    "Configuration",
    "Personalization",
    "MCP servers",
    "Git",
    "Environments",
    "Worktrees",
    "Archived threads",
  ];
  const activeNav = "Configuration";

  const updateProviderField = (providerId: ProviderId, field: "apiKey" | "model" | "baseUrl", value: string) => {
    setDraft((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [providerId]: {
          ...prev.providers[providerId],
          [field]: value,
        },
      },
    }));
  };

  const handleSave = async () => {
    const cfg = draft.providers[draft.activeProvider];
    if (!cfg?.apiKey?.trim()) {
      setError(`Please enter an API key for ${activePreset?.name ?? "the selected provider"}.`);
      return;
    }
    if (!cfg?.model?.trim()) {
      setError("Please enter a model name.");
      return;
    }
    if (!cfg?.baseUrl?.trim()) {
      setError("Please enter a base URL.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const success = await onSave({
        ...draft,
        providers: {
          ...draft.providers,
          [draft.activeProvider]: {
            ...cfg,
            apiKey: cfg.apiKey.trim(),
            model: cfg.model.trim(),
            baseUrl: cfg.baseUrl.trim(),
          },
        },
      });
      if (success) onOpenChange(false);
      else setError("Failed to save settings.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-svh w-svw max-w-none rounded-none p-0">
        <div className="flex h-full">
          <aside className="w-56 border-r border-white/10 bg-[#0f1116] p-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="mb-4 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to app
            </button>
            <div className="space-y-1">
              {navItems.map((item) => (
                <div
                  key={item}
                  className={`rounded-md px-3 py-2 text-sm ${
                    item === activeNav
                      ? "bg-white/10 text-foreground"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  {item}
                </div>
              ))}
            </div>
          </aside>

          <div className="flex-1 overflow-hidden">
            <div className="border-b border-white/10 px-6 py-5">
              <DialogHeader>
                <DialogTitle className="text-2xl font-semibold">Configuration</DialogTitle>
                <DialogDescription className="text-sm">
                  Configure API keys, models, and base URLs for multiple LangChain-compatible providers.
                  <span className="ml-1">{configuredCount}/{providers.length} configured.</span>
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="h-[calc(100%-120px)] overflow-auto px-6 py-5">
              <div className="rounded-2xl border border-white/10 bg-[#111318] p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-medium">Active Provider</div>
                      <div className="mt-2">
                        <Select
                          value={activeProvider}
                          onValueChange={(value: string) =>
                            setDraft((prev) => ({ ...prev, activeProvider: value as ProviderId }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                          <SelectContent>
                            {providers.map((provider) => {
                              const hasKey = (draft.providers[provider.id]?.apiKey || "").trim().length > 0;
                              return (
                                <SelectItem key={provider.id} value={provider.id}>
                                  <div className="flex items-center gap-2">
                                    <span>{provider.name}</span>
                                    {hasKey ? (
                                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">Configured</span>
                                    ) : (
                                      <span className="rounded border border-border px-1.5 py-0.5 text-[10px]">No Key</span>
                                    )}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-muted-foreground">
                      <p>Default provider is OpenRouter. You can switch providers anytime.</p>
                      <p className="mt-1">Each provider keeps its own API key, model, and base URL.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{activePreset?.name ?? "Provider"} Config</div>
                      {activePreset?.docsUrl ? (
                        <a
                          href={activePreset.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Docs
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>

                    <div>
                      <label className="text-xs font-medium flex items-center gap-1">
                        <KeyRound className="h-3.5 w-3.5" /> API Key
                      </label>
                      <Input
                        className="mt-2"
                        type="password"
                        placeholder="Enter API key"
                        value={activeConfig?.apiKey ?? ""}
                        onChange={(e) => updateProviderField(activeProvider, "apiKey", e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium flex items-center gap-1">
                        <Cpu className="h-3.5 w-3.5" /> Model
                      </label>
                      <Input
                        className="mt-2"
                        placeholder={activePreset?.defaultModel ?? "Model name"}
                        value={activeConfig?.model ?? ""}
                        onChange={(e) => updateProviderField(activeProvider, "model", e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium flex items-center gap-1">
                        <Link2 className="h-3.5 w-3.5" /> Base URL
                      </label>
                      <Input
                        className="mt-2"
                        placeholder={activePreset?.defaultBaseUrl ?? "https://..."}
                        value={activeConfig?.baseUrl ?? ""}
                        onChange={(e) => updateProviderField(activeProvider, "baseUrl", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {error ? (
                  <div className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                ) : null}
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
