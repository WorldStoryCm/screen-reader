import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";

interface Settings {
  hotkey: string;
  default_preset: string;
  auto_copy: boolean;
  theme: "dark" | "light";
  ocr_panel_side: "left" | "right";
}

const PRESETS = ["default_ui", "small_text", "dark_bg", "light_bg"];

export default function SettingsView() {
  const [settings, setSettings] = useState<Settings>({
    hotkey: "Ctrl+Shift+X",
    default_preset: "default_ui",
    auto_copy: false,
    theme: "dark",
    ocr_panel_side: "right",
  });
  const [saved, setSaved] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const [preset, autoCopy, hotkey, theme, panelSide] = await Promise.all([
        invoke<string | null>("get_setting", { key: "default_preset" }),
        invoke<string | null>("get_setting", { key: "auto_copy" }),
        invoke<string | null>("get_setting", { key: "hotkey" }),
        invoke<string | null>("get_setting", { key: "theme" }),
        invoke<string | null>("get_setting", { key: "ocr_panel_side" }),
      ]);

      setSettings({
        hotkey: hotkey || "Ctrl+Shift+X",
        default_preset: preset || "default_ui",
        auto_copy: autoCopy === "true",
        theme: theme === "light" ? "light" : "dark",
        ocr_panel_side: panelSide === "left" ? "left" : "right",
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
        {/* Theme */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs text-neutral-400">Theme</label>
            <p className="text-[16px] text-neutral-600">
              Switch between dark and light appearance
            </p>
          </div>
          <button
            onClick={() => {
              const newTheme = settings.theme === "dark" ? "light" : "dark";
              setSettings((s) => ({ ...s, theme: newTheme }));
              saveSetting("theme", newTheme);
              emit("theme-changed", newTheme);
            }}
            className={`w-10 h-5 rounded-full transition-colors relative ${
              settings.theme === "light" ? "bg-blue-600" : "bg-neutral-700"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                settings.theme === "light" ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>

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
          <p className="text-[16px] text-neutral-600 mt-1">
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
            <p className="text-[16px] text-neutral-600">
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

        {/* OCR Panel Position */}
        <div>
          <label className="block text-xs text-neutral-400 mb-1">
            OCR Panel Position
          </label>
          <select
            value={settings.ocr_panel_side}
            onChange={(e) => {
              const side = e.target.value as "left" | "right";
              setSettings((s) => ({ ...s, ocr_panel_side: side }));
              saveSetting("ocr_panel_side", side);
              emit("panel-side-changed", side);
            }}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-300"
          >
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
          <p className="text-[16px] text-neutral-600 mt-1">
            Side panel for OCR results on the capture screen
          </p>
        </div>
      </div>

      {saved && (
        <p className="mt-4 text-green-400 text-xs">Settings saved</p>
      )}
    </div>
  );
}
