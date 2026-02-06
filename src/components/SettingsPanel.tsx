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
import {
  AlertCircle,
  ExternalLink,
  KeyRound,
  Cpu,
  Link2,
  Settings,
  SlidersHorizontal,
  MessageSquare,
  Sun,
  Moon,
  Monitor,
  Info,
} from "lucide-react";
import { ProviderId, ProviderPreset, PROVIDER_PRESETS } from "@/lib/providers";
import type { Settings as SettingsType } from "@/hooks/useSettings";
import { useTheme } from "@/hooks/useTheme";
import { listThreads, loadThreadHistory, formatThreadHistoryMarkdown } from "@/lib/threadHistory";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: SettingsType;
  providers?: ProviderPreset[];
  onSave: (settings: SettingsType) => Promise<boolean>;
}

const navIcons: Record<string, React.ReactNode> = {
  General: <Settings className="h-4 w-4" />,
  Models: <SlidersHorizontal className="h-4 w-4" />,
  Threads: <MessageSquare className="h-4 w-4" />,
  About: <Info className="h-4 w-4" />,
};

export function SettingsPanel({
  open,
  onOpenChange,
  settings,
  providers = PROVIDER_PRESETS,
  onSave,
}: SettingsPanelProps) {
  const [draft, setDraft] = useState<SettingsType>(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [activeNav, setActiveNav] = useState("General");
  const { theme, setTheme, resolvedTheme } = useTheme();

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
    "Models",
    "Threads",
    "About",
  ];
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

  const handleExportAll = async () => {
    try {
      setExporting(true);
      const threads = await listThreads();
      const sections: string[] = [];
      sections.push("# Chat History Export");
      sections.push("");
      for (const thread of threads) {
        const repo = await loadThreadHistory(thread.id);
        sections.push(formatThreadHistoryMarkdown(repo, thread.title || "New Chat"));
        sections.push("");
      }
      const selected = await saveDialog({
        title: "Export chat history",
        defaultPath: "chat_history.md",
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (!selected) return;
      await writeTextFile(selected, sections.join("\n"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export chat history.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-4xl flex-col overflow-hidden rounded-2xl border-[var(--surface-border-subtle)] bg-panel-base p-0">

        <div className="relative flex min-h-0 flex-1">
          {/* Sidebar */}
          <aside className="w-60 shrink-0 border-r border-[var(--surface-border-subtle)] p-5">
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-foreground">Settings</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground/50">Manage your preferences</p>
            </div>
            <nav className="space-y-0.5">
              {navItems.map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => setActiveNav(item)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    item === activeNav
                      ? "border-l-2 border-l-blue-400 bg-[var(--surface-active)] pl-[10px] font-medium text-foreground"
                      : "text-muted-foreground/70 hover:bg-[var(--surface-hover)] hover:text-foreground"
                  }`}
                >
                  <span className={item === activeNav ? "text-blue-400" : ""}>{navIcons[item]}</span>
                  {item}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {activeNav === "General" ? (
              <>
                <div className="shrink-0 px-6 pb-4 pt-6">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2.5 text-xl font-semibold">
                      <Settings className="h-5 w-5 text-blue-400" />
                      General
                    </DialogTitle>
                    <DialogDescription className="mt-1.5 text-sm text-muted-foreground">
                      General application preferences
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-4 h-px bg-gradient-to-r from-[var(--surface-divider)] via-[var(--surface-elevated)] to-transparent" />
                </div>

                <div className="flex-1 overflow-auto px-6 pb-6">
                  {/* Appearance card */}
                  <div className="rounded-xl border border-[var(--surface-border-subtle)] bg-[var(--surface-elevated)] p-5">
                    <div className="mb-4">
                      <div className="text-sm font-medium">Appearance</div>
                      <p className="mt-0.5 text-xs text-muted-foreground/50">Choose your preferred color theme</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        { value: "light" as const, label: "Light", icon: Sun },
                        { value: "dark" as const, label: "Dark", icon: Moon },
                        { value: "system" as const, label: "System", icon: Monitor },
                      ]).map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setTheme(value)}
                          className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors ${
                            theme === value
                              ? "border-blue-400 bg-blue-500/10 text-foreground"
                              : "border-[var(--surface-border-subtle)] bg-[var(--surface-elevated)] text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-foreground"
                          }`}
                        >
                          <Icon className={`h-5 w-5 ${theme === value ? "text-blue-400" : ""}`} />
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground/50">
                      Currently showing {resolvedTheme} mode{theme === "system" ? " (based on system preference)" : ""}
                    </p>
                  </div>
                </div>
              </>
            ) : activeNav === "Models" ? (
              <>
                <div className="shrink-0 px-6 pb-4 pt-6">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2.5 text-xl font-semibold">
                      <SlidersHorizontal className="h-5 w-5 text-blue-400" />
                      Models
                    </DialogTitle>
                    <DialogDescription className="mt-1.5 text-sm text-muted-foreground">
                      Configure API keys, models, and base URLs.
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-[var(--surface-active)] px-2 py-0.5 text-[11px]">
                        {configuredCount}/{providers.length} configured
                      </span>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-4 h-px bg-gradient-to-r from-[var(--surface-divider)] via-[var(--surface-elevated)] to-transparent" />
                </div>

                <div className="flex-1 overflow-auto px-6 pb-6">
                  {/* Provider selector card */}
                  <div className="rounded-xl border border-[var(--surface-border-subtle)] bg-[var(--surface-elevated)] p-5">
                    <div className="mb-4">
                      <div className="text-sm font-medium">Active Provider</div>
                      <p className="mt-0.5 text-xs text-muted-foreground/50">Select which LLM provider to use</p>
                    </div>
                    <Select
                      value={activeProvider}
                      onValueChange={(value: string) =>
                        setDraft((prev) => ({ ...prev, activeProvider: value as ProviderId }))
                      }
                    >
                    <SelectTrigger className="min-w-[220px] border-[var(--surface-border-subtle)] bg-[var(--surface-hover)] focus:ring-1 focus:ring-[var(--surface-border)] [&>span]:line-clamp-none [&>span]:whitespace-nowrap">
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
                                  <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">Configured</span>
                                ) : (
                                  <span className="rounded-full border border-[var(--surface-border)] px-1.5 py-0.5 text-[10px] text-muted-foreground/50">No Key</span>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>

                    {/* Provider info */}
                    <div className="mt-4 rounded-lg border border-[var(--surface-border-subtle)] bg-[var(--surface-elevated)] p-3 text-xs leading-relaxed text-muted-foreground/60">
                      <p>Default provider is OpenRouter. You can switch providers anytime.</p>
                      <p className="mt-1">Each provider keeps its own API key, model, and base URL.</p>
                    </div>
                  </div>

                  {/* Config fields card */}
                  <div className="mt-4 rounded-xl border border-[var(--surface-border-subtle)] bg-[var(--surface-elevated)] p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{activePreset?.name ?? "Provider"} Config</div>
                        <p className="mt-0.5 text-xs text-muted-foreground/50">API key, model, and endpoint</p>
                      </div>
                      {activePreset?.docsUrl ? (
                        <a
                          href={activePreset.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--surface-border-subtle)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-[var(--surface-hover)] hover:text-foreground"
                        >
                          Docs
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>

                    <div className="space-y-0">
                      {/* API Key */}
                      <div className="border-b border-[var(--surface-border-subtle)] pb-4">
                        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/80">
                          <KeyRound className="h-3.5 w-3.5" /> API Key
                        </label>
                        <Input
                          className="mt-2 border-[var(--surface-border-subtle)] bg-[var(--surface-hover)] focus:border-[var(--surface-border)] focus:ring-1 focus:ring-[var(--surface-border)]"
                          type="password"
                          placeholder="Enter API key"
                          value={activeConfig?.apiKey ?? ""}
                          onChange={(e) => updateProviderField(activeProvider, "apiKey", e.target.value)}
                        />
                      </div>

                      {/* Model */}
                      <div className="border-b border-[var(--surface-border-subtle)] pb-4 pt-4">
                        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/80">
                          <Cpu className="h-3.5 w-3.5" /> Model
                        </label>
                        <Input
                          className="mt-2 border-[var(--surface-border-subtle)] bg-[var(--surface-hover)] focus:border-[var(--surface-border)] focus:ring-1 focus:ring-[var(--surface-border)]"
                          placeholder={activePreset?.defaultModel ?? "Model name"}
                          value={activeConfig?.model ?? ""}
                          onChange={(e) => updateProviderField(activeProvider, "model", e.target.value)}
                        />
                      </div>

                      {/* Base URL */}
                      <div className="pt-4">
                        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/80">
                          <Link2 className="h-3.5 w-3.5" /> Base URL
                        </label>
                        <Input
                          className="mt-2 border-[var(--surface-border-subtle)] bg-[var(--surface-hover)] focus:border-[var(--surface-border)] focus:ring-1 focus:ring-[var(--surface-border)]"
                          placeholder={activePreset?.defaultBaseUrl ?? "https://..."}
                          value={activeConfig?.baseUrl ?? ""}
                          onChange={(e) => updateProviderField(activeProvider, "baseUrl", e.target.value)}
                        />
                      </div>
                    </div>

                    {error ? (
                      <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {error}
                      </div>
                    ) : null}
                  </div>

                  {/* Action buttons */}
                  <div className="mt-5 flex items-center justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      className="border-[var(--surface-border-subtle)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)]"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save changes"}
                    </Button>
                  </div>
                </div>
              </>
            ) : activeNav === "Threads" ? (
              <>
                <div className="shrink-0 px-6 pb-4 pt-6">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2.5 text-xl font-semibold">
                      <MessageSquare className="h-5 w-5 text-blue-400" />
                      Threads
                    </DialogTitle>
                    <DialogDescription className="mt-1.5 text-sm text-muted-foreground">
                      Export your chat history.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-4 h-px bg-gradient-to-r from-[var(--surface-divider)] via-[var(--surface-elevated)] to-transparent" />
                </div>

                <div className="flex-1 overflow-auto px-6 pb-6">
                  <div className="rounded-xl border border-[var(--surface-border-subtle)] bg-[var(--surface-elevated)] p-5">
                    <div className="mb-4">
                      <div className="text-sm font-medium">Export all threads</div>
                      <p className="mt-0.5 text-xs text-muted-foreground/50">
                        Export the full chat history as Markdown.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="border-[var(--surface-border-subtle)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)]"
                      onClick={() => void handleExportAll()}
                      disabled={exporting}
                    >
                      {exporting ? "Exporting..." : "Export Markdown"}
                    </Button>
                  </div>
                </div>
              </>
            ) : activeNav === "About" ? (
              <>
                <div className="shrink-0 px-6 pb-4 pt-6">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2.5 text-xl font-semibold">
                      <Info className="h-5 w-5 text-blue-400" />
                      About
                    </DialogTitle>
                    <DialogDescription className="mt-1.5 text-sm text-muted-foreground">
                      About OhMyCowork
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-4 h-px bg-gradient-to-r from-[var(--surface-divider)] via-[var(--surface-elevated)] to-transparent" />
                </div>

                <div className="flex-1 overflow-auto px-6 pb-6">
                  <div className="rounded-xl border border-[var(--surface-border-subtle)] bg-[var(--surface-elevated)] p-5">
                    <div className="text-sm font-medium">OhMyCowork</div>
                    <p className="mt-1 text-xs text-muted-foreground">AI-powered workspace for creative collaboration.</p>
                    <a
                      href="https://ohmyco.work"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-400 transition-colors hover:text-blue-300"
                    >
                      ohmyco.work
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  <div className="mt-4 rounded-xl border border-[var(--surface-border-subtle)] bg-[var(--surface-elevated)] p-5">
                    <div className="text-sm font-medium">More Apps</div>
                    <p className="mt-1 text-xs text-muted-foreground">Check out other projects by the author.</p>
                    <a
                      href="https://xnu.app"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-400 transition-colors hover:text-blue-300"
                    >
                      xnu.app
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-muted-foreground">Coming soon</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
