import { useCallback, useEffect, useRef, useState } from "react";
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
        <HotkeyRecorder
          value={settings.hotkey}
          onChange={(hotkey) => {
            setSettings((s) => ({ ...s, hotkey }));
          }}
        />

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

// --- Hotkey Recorder ---

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

function keyToLabel(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  if (e.code.startsWith("Key")) return e.code.slice(3);
  if (e.code.startsWith("Digit")) return e.code.slice(5);
  if (e.code.startsWith("Arrow")) return e.code.slice(5);
  const map: Record<string, string> = {
    Space: "Space", Enter: "Enter", Escape: "Escape", Backspace: "Backspace",
    Tab: "Tab", Delete: "Delete", Home: "Home", End: "End",
    PageUp: "PageUp", PageDown: "PageDown", PrintScreen: "PrintScreen",
    Insert: "Insert", Comma: ",", Period: ".", Slash: "/",
    Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[",
    BracketRight: "]", Backslash: "\\", Semicolon: ";", Quote: "'",
  };
  if (e.code.startsWith("F") && /^F\d+$/.test(e.code)) return e.code;
  return map[e.code] || e.code;
}

function HotkeyRecorder({ value, onChange }: { value: string; onChange: (hotkey: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!recording) return;

    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecording(false);
        return;
      }

      const key = keyToLabel(e);
      if (!key) return; // modifier-only press, keep waiting

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.shiftKey) parts.push("Shift");
      if (e.altKey) parts.push("Alt");
      if (e.metaKey) parts.push("Cmd");
      parts.push(key);

      if (parts.length < 2) {
        setError("Use at least one modifier (Ctrl, Shift, Alt)");
        return;
      }

      const hotkey = parts.join("+");
      setRecording(false);
      setError(null);

      invoke("update_hotkey", { hotkey })
        .then(() => onChange(hotkey))
        .catch((err) => setError(String(err)));
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recording, onChange]);

  return (
    <div>
      <label className="block text-xs text-neutral-400 mb-1">Global Hotkey</label>
      <div className="flex gap-2 items-center">
        <button
          ref={inputRef}
          onClick={() => { setRecording(true); setError(null); }}
          className={`flex-1 px-3 py-2 text-left rounded text-sm transition-colors ${
            recording
              ? "bg-blue-900/50 border-2 border-blue-500 text-blue-300 animate-pulse"
              : "bg-neutral-800 border border-neutral-700 text-neutral-300"
          }`}
        >
          {recording ? "Press keys..." : value}
        </button>
        {recording && (
          <button
            onClick={() => setRecording(false)}
            className="px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 rounded transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      <p className="text-[16px] text-neutral-600 mt-1">
        Click to record a new shortcut (Esc to cancel)
      </p>
    </div>
  );
}
