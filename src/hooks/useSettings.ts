import { useState, useEffect, useCallback } from "react";
import { Store } from "@tauri-apps/plugin-store";

const SETTINGS_STORE = "settings.json";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

export type Settings = {
  apiKey: string;
  model: string;
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({
    apiKey: "",
    model: DEFAULT_MODEL,
  });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const store = await Store.load(SETTINGS_STORE);
        const storedKey = (await store.get<string>("openRouterApiKey")) ?? "";
        const storedModel =
          (await store.get<string>("openRouterModel")) ?? DEFAULT_MODEL;
        setSettings({
          apiKey: storedKey,
          model: storedModel,
        });
        setError(null);
      } catch (err) {
        setSettings({ apiKey: "", model: DEFAULT_MODEL });
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
      await store.set("openRouterApiKey", newSettings.apiKey);
      await store.set("openRouterModel", newSettings.model || DEFAULT_MODEL);
      await store.save();
      setSettings({
        apiKey: newSettings.apiKey,
        model: newSettings.model || DEFAULT_MODEL,
      });
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
  model: DEFAULT_MODEL,
};
