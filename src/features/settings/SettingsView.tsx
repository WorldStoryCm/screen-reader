import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Settings {
  hotkey: string;
  default_preset: string;
  auto_copy: boolean;
}

const PRESETS = ["default_ui", "small_text", "dark_bg", "light_bg"];

export default function SettingsView() {
  const [settings, setSettings] = useState<Settings>({
    hotkey: "Ctrl+Shift+X",
    default_preset: "default_ui",
    auto_copy: false,
  });
  const [saved, setSaved] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const preset = await invoke<string | null>("get_setting", {
        key: "default_preset",
      });
      const autoCopy = await invoke<string | null>("get_setting", {
        key: "auto_copy",
      });
      const hotkey = await invoke<string | null>("get_setting", {
        key: "hotkey",
      });

      setSettings({
        hotkey: hotkey || "Ctrl+Shift+X",
        default_preset: preset || "default_ui",
        auto_copy: autoCopy === "true",
      });
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function saveSetting(key: string, value: string) {
    try {
      await invoke("set_setting", { key, value });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      console.error("Failed to save setting:", err);
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-lg font-semibold mb-6">Settings</h2>

      <div className="space-y-5">
        {/* Hotkey */}
        <div>
          <label className="block text-xs text-neutral-400 mb-1">
            Global Hotkey
          </label>
          <input
            type="text"
            value={settings.hotkey}
            readOnly
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-300"
          />
          <p className="text-[14px] text-neutral-600 mt-1">
            Hotkey editing coming soon
          </p>
        </div>

        {/* Default preset */}
        <div>
          <label className="block text-xs text-neutral-400 mb-1">
            Default OCR Preset
          </label>
          <select
            value={settings.default_preset}
            onChange={(e) => {
              setSettings((s) => ({ ...s, default_preset: e.target.value }));
              saveSetting("default_preset", e.target.value);
            }}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-300"
          >
            {PRESETS.map((p) => (
              <option key={p} value={p}>
                {p.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        {/* Auto copy */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs text-neutral-400">Auto-copy after OCR</label>
            <p className="text-[14px] text-neutral-600">
              Automatically copy text to clipboard after capture
            </p>
          </div>
          <button
            onClick={() => {
              const newVal = !settings.auto_copy;
              setSettings((s) => ({ ...s, auto_copy: newVal }));
              saveSetting("auto_copy", String(newVal));
            }}
            className={`w-10 h-5 rounded-full transition-colors relative ${
              settings.auto_copy ? "bg-blue-600" : "bg-neutral-700"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                settings.auto_copy ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {saved && (
        <p className="mt-4 text-green-400 text-xs">Settings saved</p>
      )}
    </div>
  );
}
