import { useState, useEffect, useCallback } from "react";
import { Store } from "@tauri-apps/plugin-store";
import {
  DEFAULT_PROVIDER_ID,
  ProviderConfig,
  ProviderId,
  createDefaultProviderConfigs,
} from "@/lib/providers";

const SETTINGS_STORE = "settings.json";

export type Settings = {
  activeProvider: ProviderId;
  providers: Record<ProviderId, ProviderConfig>;
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({
    activeProvider: DEFAULT_PROVIDER_ID,
    providers: createDefaultProviderConfigs(),
  });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const store = await Store.load(SETTINGS_STORE);
        const defaults = createDefaultProviderConfigs();
        const stored = await store.get<Settings>("llmSettings");

        if (stored?.providers && stored?.activeProvider) {
          setSettings({
            activeProvider: stored.activeProvider,
            providers: { ...defaults, ...stored.providers },
          });
        } else {
          // Migrate legacy single-provider settings to OpenRouter.
          const legacyKey = (await store.get<string>("openRouterApiKey")) ?? "";
          const legacyModel =
            (await store.get<string>("openRouterModel")) ?? defaults.openrouter.model;
          setSettings({
            activeProvider: DEFAULT_PROVIDER_ID,
            providers: {
              ...defaults,
              openrouter: {
                ...defaults.openrouter,
                apiKey: legacyKey,
                model: legacyModel,
              },
            },
          });
        }
        setError(null);
      } catch (err) {
        setSettings({
          activeProvider: DEFAULT_PROVIDER_ID,
          providers: createDefaultProviderConfigs(),
        });
        setError(err instanceof Error ? err.message : "Failed to load settings.");
      } finally {
        setLoaded(true);
      }
    };
    void loadSettings();
  }, []);

  const saveSettings = useCallback(async (newSettings: Settings) => {
    try {
      const store = await Store.load(SETTINGS_STORE);
      await store.set("llmSettings", newSettings);
      await store.save();
      setSettings(newSettings);
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
      return false;
    }
  }, []);

  return {
    settings,
    loaded,
    error,
    saveSettings,
    clearError: () => setError(null),
  };
}

export const DEFAULT_SETTINGS = {
  activeProvider: DEFAULT_PROVIDER_ID,
};
