import { useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import ResultPanel from "./capture/ResultPanel";
import HistoryView from "./history/HistoryView";
import CardsView from "./cards/CardsView";
import SettingsView from "./settings/SettingsView";

type Tab = "home" | "history" | "cards" | "settings";

export default function MainView() {
  const [tab, setTab] = useState<Tab>("home");
  const [status, setStatus] = useState(isTauri() ? "Ready" : "Not running in Tauri — use 'bun tauri dev'");

  async function handleCapture() {
    console.log("[MainView] handleCapture called, isTauri:", isTauri());
    if (!isTauri()) {
      setStatus("Error: Not running in Tauri webview. Run 'bun tauri dev' instead of 'bun run dev'");
      return;
    }
    try {
      await invoke("open_capture_overlay");
      setStatus("Capture overlay opened");
    } catch (err) {
      console.error("[MainView] open_capture_overlay failed:", err);
      setStatus("Error: " + String(err));
    }
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-neutral-100">
      {/* Tab bar */}
      <nav className="flex border-b border-neutral-700 bg-neutral-800 shrink-0">
        {(["home", "history", "cards", "settings"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium capitalize transition-colors ${
              tab === t
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === "home" && (
          <main className="flex flex-col items-center justify-center h-full p-8">
            <h1 className="text-2xl font-bold mb-4">Game OCR</h1>
            <p className="text-neutral-400 text-sm mb-6">
              Press{" "}
              <kbd className="px-2 py-0.5 bg-neutral-700 rounded text-xs font-mono">
                Ctrl+Shift+X
              </kbd>{" "}
              to capture a region
            </p>
            <button
              onClick={handleCapture}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors"
            >
              Capture Region
            </button>
            <p className="mt-4 text-neutral-500 text-xs">{status}</p>
          </main>
        )}
        {tab === "history" && <HistoryView />}
        {tab === "cards" && <CardsView />}
        {tab === "settings" && <SettingsView />}
      </div>

      <ResultPanel />
    </div>
  );
}
