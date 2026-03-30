import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { CaptureResult } from "../../types/ocr";
import { Button } from "@/components/button";

export default function ResultPanel() {
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;
    listen<CaptureResult>("ocr-result", (event) => {
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
        if (cancelled) fn();
        else unlistenRef.current = fn;
      })
      .catch(console.error);

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
      await invoke("open_capture_overlay");
    } catch (err) {
      console.error("[ResultPanel] Recapture failed:", err);
    }
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        copyAll();
      } else if (e.key === "r" || e.key === "R") {
        if (!e.metaKey && !e.ctrlKey) handleRecapture();
      } else if (e.key === "Escape") {
        setResult(null);
        setError(null);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [copyAll, handleRecapture]);

  if (!result && !error) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-[50vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <span className="text-sm font-medium text-muted-foreground">
          OCR Result
          {result && (
            <span className="ml-2 text-muted-foreground/50 font-mono">
              {result.ocrResult.confidence.toFixed(0)}%
            </span>
          )}
        </span>
        <button
          onClick={() => { setResult(null); setError(null); }}
          className="text-muted-foreground hover:text-foreground text-sm leading-none transition-colors"
        >
          ×
        </button>
      </div>

      {error && (
        <div className="p-4 text-destructive text-sm">{error}</div>
      )}

      {result && (
        <div className="flex-1 overflow-y-auto p-2">
          {lines.map((line, i) => (
            <div
              key={i}
              onClick={() => setSelectedLine(i === selectedLine ? null : i)}
              className={`px-2 py-1.5 rounded-md text-base cursor-pointer transition-colors ${
                i === selectedLine
                  ? "bg-primary/15 text-primary"
                  : "hover:bg-accent text-foreground"
              }`}
            >
              {line}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 px-4 py-2.5 border-t border-border">
        <Button size="sm" onClick={copyAll} disabled={!result}>
          {copied ? "Copied!" : "Copy all"}
        </Button>
        {selectedLine !== null && (
          <Button variant="secondary" size="sm" onClick={copyLine}>
            Copy line
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={handleRecapture}>
          Recapture
        </Button>
      </div>

      {/* Keyboard hints */}
      <div className="px-4 py-1.5 border-t border-border text-xs text-muted-foreground/40 font-mono">
        enter: copy · r: recapture · esc: close
      </div>
    </div>
  );
}
