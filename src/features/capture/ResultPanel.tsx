import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { CaptureResult } from "../../types/ocr";

export default function ResultPanel() {
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    console.log("[ResultPanel] mounting, isTauri:", isTauri());
    if (!isTauri()) {
      console.warn("[ResultPanel] Not running in Tauri webview — skipping event listener");
      return;
    }

    let cancelled = false;
    listen<CaptureResult>("ocr-result", (event) => {
      console.log("[ResultPanel] received ocr-result event:", event.payload);
      const data = event.payload;
      if (data.ocrResult.error) {
        setError(data.ocrResult.error);
        setResult(null);
      } else {
        setResult(data);
        setError(null);
      }
    })
      .then((fn) => {
        if (cancelled) {
          fn();
        } else {
          unlistenRef.current = fn;
          console.log("[ResultPanel] event listener registered");
        }
      })
      .catch((err) => {
        console.error("[ResultPanel] Failed to register event listener:", err);
      });

    return () => {
      cancelled = true;
      unlistenRef.current?.();
    };
  }, []);

  const lines = result?.ocrResult.normalized_text.split("\n").filter(Boolean) ?? [];

  const copyAll = useCallback(async () => {
    if (!result) return;
    await writeText(result.ocrResult.normalized_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [result]);

  const copyLine = useCallback(async () => {
    if (selectedLine === null || !lines[selectedLine]) return;
    await writeText(lines[selectedLine]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [selectedLine, lines]);

  const handleRecapture = useCallback(async () => {
    try {
      console.log("[ResultPanel] recapture requested");
      await invoke("open_capture_overlay");
    } catch (err) {
      console.error("[ResultPanel] Recapture failed:", err);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        copyAll();
      } else if (e.key === "r" || e.key === "R") {
        if (!e.metaKey && !e.ctrlKey) {
          handleRecapture();
        }
      } else if (e.key === "Escape") {
        setResult(null);
        setError(null);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [copyAll, handleRecapture]);

  if (!result && !error) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-[50vh] bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-neutral-800 border-b border-neutral-700 cursor-move">
        <span className="text-xs text-neutral-400 font-medium">
          OCR Result
          {result && (
            <span className="ml-2 text-neutral-500">
              {result.ocrResult.confidence.toFixed(0)}% conf
            </span>
          )}
        </span>
        <button
          onClick={() => { setResult(null); setError(null); }}
          className="text-neutral-500 hover:text-neutral-300 text-sm"
        >
          ×
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 text-red-400 text-sm">{error}</div>
      )}

      {/* Text content */}
      {result && (
        <div className="flex-1 overflow-y-auto p-3">
          {lines.map((line, i) => (
            <div
              key={i}
              onClick={() => setSelectedLine(i === selectedLine ? null : i)}
              className={`px-2 py-1 rounded text-sm cursor-pointer transition-colors ${
                i === selectedLine
                  ? "bg-blue-600/30 text-blue-200"
                  : "hover:bg-neutral-800 text-neutral-200"
              }`}
            >
              {line}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 px-3 py-2 border-t border-neutral-700 bg-neutral-800">
        <button
          onClick={copyAll}
          disabled={!result}
          className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded font-medium transition-colors"
        >
          {copied ? "Copied!" : "Copy All"}
        </button>
        {selectedLine !== null && (
          <button
            onClick={copyLine}
            className="px-3 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 rounded font-medium transition-colors"
          >
            Copy Line
          </button>
        )}
        <button
          onClick={handleRecapture}
          className="px-3 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 rounded font-medium transition-colors"
        >
          Recapture
        </button>
      </div>

      {/* Keyboard hints */}
      <div className="px-3 py-1 border-t border-neutral-800 text-[10px] text-neutral-600">
        Enter: copy all · R: recapture · Esc: close
      </div>
    </div>
  );
}
