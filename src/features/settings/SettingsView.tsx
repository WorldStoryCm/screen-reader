import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { Button } from "@/components/button";
import { Label } from "@/components/label";
import { Switch } from "@/components/switch";
import { Separator } from "@/components/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/select";

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
      <h2 className="text-base font-semibold text-foreground mb-6">Settings</h2>

      <div className="space-y-6">
        {/* Theme */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label>Theme</Label>
            <p className="text-sm text-muted-foreground">
              Dark or light appearance
            </p>
          </div>
          <Switch
            checked={settings.theme === "light"}
            onCheckedChange={(checked) => {
              const newTheme = checked ? "light" : "dark";
              setSettings((s) => ({ ...s, theme: newTheme }));
              saveSetting("theme", newTheme);
              emit("theme-changed", newTheme);
            }}
          />
        </div>

        <Separator />

        {/* Hotkey */}
        <HotkeyRecorder
          value={settings.hotkey}
          onChange={(hotkey) => {
            setSettings((s) => ({ ...s, hotkey }));
          }}
        />

        <Separator />

        {/* Default preset */}
        <div className="space-y-1.5">
          <Label>Default OCR preset</Label>
          <Select
            value={settings.default_preset}
            onValueChange={(val) => {
              setSettings((s) => ({ ...s, default_preset: val }));
              saveSetting("default_preset", val);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Auto copy */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label>Auto-copy after OCR</Label>
            <p className="text-sm text-muted-foreground">
              Copy recognized text to clipboard automatically
            </p>
          </div>
          <Switch
            checked={settings.auto_copy}
            onCheckedChange={(checked) => {
              setSettings((s) => ({ ...s, auto_copy: checked }));
              saveSetting("auto_copy", String(checked));
            }}
          />
        </div>

        <Separator />

        {/* OCR Panel Position */}
        <div className="space-y-1.5">
          <Label>Results panel position</Label>
          <Select
            value={settings.ocr_panel_side}
            onValueChange={(val) => {
              const side = val as "left" | "right";
              setSettings((s) => ({ ...s, ocr_panel_side: side }));
              saveSetting("ocr_panel_side", side);
              emit("panel-side-changed", side);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Which side to show OCR results on the capture screen
          </p>
        </div>
      </div>

      {saved && (
        <p className="mt-4 text-sm text-emerald-400 transition-opacity">Saved</p>
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
      if (!key) return;

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
    <div className="space-y-1.5">
      <Label>Capture hotkey</Label>
      <div className="flex gap-2 items-center">
        <button
          ref={inputRef}
          onClick={() => { setRecording(true); setError(null); }}
          className={`flex-1 px-3 py-2 text-left rounded-md text-sm font-mono transition-all ${
            recording
              ? "bg-primary/10 border-2 border-primary text-primary animate-pulse"
              : "bg-input border border-border text-foreground hover:border-ring"
          }`}
        >
          {recording ? "Press keys\u2026" : value}
        </button>
        {recording && (
          <Button variant="ghost" size="sm" onClick={() => setRecording(false)}>
            Cancel
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-sm text-muted-foreground">
        Click to record a new shortcut · Esc to cancel
      </p>
    </div>
  );
}
