import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { OcrResult } from "../types/ocr";
import TokenizedText from "./capture/TokenizedText";
import HistoryView from "./history/HistoryView";
import CardsView from "./cards/CardsView";
import SettingsView from "./settings/SettingsView";
import TagsView from "./tags/TagsView";
import { Button } from "@/components/button";

interface Region {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface CaptureEntry {
  imagePath: string;
  text: string;
  confidence: number;
  timestamp: number;
}

type Tab = "capture" | "history" | "cards" | "tags" | "settings";

export default function MainView() {
  const [tab, setTab] = useState<Tab>("capture");

  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [natW, setNatW] = useState(0);
  const [natH, setNatH] = useState(0);

  const [zoom, setZoom] = useState(1);
  const [isFit, setIsFit] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [region, setRegion] = useState<Region | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, scrollX: 0, scrollY: 0 });

  const [results, setResults] = useState<CaptureEntry[]>([]);
  const [copied, setCopied] = useState<number | null>(null);

  const [panelWidth, setPanelWidth] = useState(220);
  const [panelSide, setPanelSide] = useState<"left" | "right">("right");

  const [hotkeyLabel, setHotkeyLabel] = useState("Ctrl+Shift+X");

  const hasScreenshot = useRef(false);
  hasScreenshot.current = !!screenshotUrl;

  useEffect(() => {
    const unlisten = listen("trigger-capture", () => handleCapture());
    return () => { unlisten.then(fn => fn()); };
  }, []);

  useEffect(() => {
    const c = containerRef.current;
    if (!c || !natW) return;
    const ro = new ResizeObserver(() => { if (isFit) setZoom(calcFit()); });
    ro.observe(c);
    return () => ro.disconnect();
  }, [natW, natH, isFit]);

  useEffect(() => {
    invoke<string | null>("get_setting", { key: "hotkey" })
      .then(v => { if (v) setHotkeyLabel(v); })
      .catch(() => {});
    const unlisten = listen<string>("hotkey-changed", (e) => {
      setHotkeyLabel(e.payload);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  useEffect(() => {
    invoke<string | null>("get_setting", { key: "ocr_panel_side" })
      .then(v => { if (v === "left" || v === "right") setPanelSide(v); })
      .catch(() => {});
    const unlisten = listen<string>("panel-side-changed", (e) => {
      if (e.payload === "left" || e.payload === "right") setPanelSide(e.payload);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  useEffect(() => {
    if (tab !== "capture") return;
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!hasScreenshot.current) return;
      e.preventDefault();
      setZoom(prev => {
        const next = prev * (e.deltaY > 0 ? 0.9 : 1.1);
        return Math.min(Math.max(next, 0.05), 5);
      });
      setIsFit(false);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [tab]);

  function calcFit(): number {
    const c = containerRef.current;
    if (!c || !natW || !natH) return 1;
    return Math.min(c.clientWidth / natW, c.clientHeight / natH, 1);
  }

  const handleCapture = useCallback(async () => {
    setCapturing(true);
    setError(null);
    setRegion(null);
    setTab("capture");
    setIsFit(true);
    try {
      const path = await invoke<string>("capture_screen");
      setScreenshotUrl(convertFileSrc(path) + "?t=" + Date.now());
    } catch (err) {
      setError("Capture failed: " + String(err));
    } finally {
      setCapturing(false);
    }
  }, []);

  function onImageLoad() {
    const img = imgRef.current;
    if (!img) return;
    setNatW(img.naturalWidth);
    setNatH(img.naturalHeight);
    const c = containerRef.current;
    if (c) {
      const fit = Math.min(c.clientWidth / img.naturalWidth, c.clientHeight / img.naturalHeight, 1);
      setZoom(fit);
      setIsFit(true);
    }
  }

  function doZoom(z: number) {
    setZoom(Math.min(Math.max(z, 0.05), 5));
    setIsFit(false);
  }

  const dispW = natW * zoom;
  const dispH = natH * zoom;

  function getImageCoords(e: React.MouseEvent) {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button === 1) {
      e.preventDefault();
      setZoom(1);
      setIsFit(false);
      return;
    }
    if (e.button === 2) {
      e.preventDefault();
      const c = containerRef.current;
      if (!c) return;
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, scrollX: c.scrollLeft, scrollY: c.scrollTop };
      return;
    }
    if (e.button !== 0) return;
    if (processing || !screenshotUrl) return;
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = getImageCoords(e);
    setIsDragging(true);
    setRegion({ startX: x, startY: y, endX: x, endY: y });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (isPanning) {
      e.preventDefault();
      const c = containerRef.current;
      if (!c) return;
      c.scrollLeft = panStart.current.scrollX - (e.clientX - panStart.current.x);
      c.scrollTop = panStart.current.scrollY - (e.clientY - panStart.current.y);
      return;
    }
    if (!isDragging || !region) return;
    e.preventDefault();
    const { x, y } = getImageCoords(e);
    setRegion(prev => prev ? { ...prev, endX: x, endY: y } : null);
  }

  async function handleMouseUp() {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    if (!isDragging || !region) return;
    setIsDragging(false);

    const x = Math.min(region.startX, region.endX);
    const y = Math.min(region.startY, region.endY);
    const w = Math.abs(region.endX - region.startX);
    const h = Math.abs(region.endY - region.startY);

    if (w < 10 || h < 10) { setRegion(null); return; }

    const sx = natW / dispW;
    const sy = natH / dispH;

    setProcessing(true);
    setError(null);

    try {
      const imagePath = await invoke<string>("crop_and_save", {
        x: Math.round(x * sx),
        y: Math.round(y * sy),
        width: Math.round(w * sx),
        height: Math.round(h * sy),
      });

      const ocrResult = await invoke<OcrResult>("run_ocr", {
        imagePath,
        preset: "default_ui",
      });

      if (ocrResult.error) {
        setError("OCR: " + ocrResult.error);
      } else {
        try {
          await invoke("save_capture", {
            input: {
              image_path: imagePath,
              ocr_text: ocrResult.raw_text,
              normalized_text: ocrResult.normalized_text,
              preprocess_preset: "default_ui",
              confidence: ocrResult.confidence,
            },
          });
        } catch (saveErr) {
          console.error("[MainView] DB save failed:", saveErr);
        }

        const text = ocrResult.normalized_text || ocrResult.raw_text;
        if (text.trim()) {
          setResults(prev => [{
            imagePath, text,
            confidence: ocrResult.confidence,
            timestamp: Date.now(),
          }, ...prev]);
        } else {
          setError("No text found — try selecting a larger region");
        }
      }
      setRegion(null);
    } catch (err) {
      setError("OCR failed: " + String(err));
    } finally {
      setProcessing(false);
    }
  }

  async function copyText(text: string, index: number) {
    await writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 1500);
  }

  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidth;
    const side = panelSide;
    function onMove(ev: MouseEvent) {
      const delta = side === "right" ? startX - ev.clientX : ev.clientX - startX;
      setPanelWidth(Math.max(100, Math.min(600, startW + delta)));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  const selRect = region ? {
    left: Math.min(region.startX, region.endX),
    top: Math.min(region.startY, region.endY),
    width: Math.abs(region.endX - region.startX),
    height: Math.abs(region.endY - region.startY),
  } : null;

  const tabs: { key: Tab; label: string }[] = [
    { key: "capture", label: "Reader" },
    { key: "cards", label: "Cards" },
    { key: "history", label: "History" },
    { key: "tags", label: "Tags" },
    { key: "settings", label: "Settings" },
  ];

  function renderResultsPanel(side: "left" | "right") {
    return (
      <div
        style={{ width: panelWidth }}
        className={`flex flex-col shrink-0 overflow-hidden bg-card ${
          side === "left" ? "border-r" : "border-l"
        } border-border`}
      >
        <div className="px-3 py-2 border-b border-border shrink-0">
          <span className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
            Results · {results.length}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-visible">
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8 gap-2">
              <span className="text-muted-foreground/40 text-2xl">&#x2725;</span>
              <p className="text-sm text-muted-foreground">
                Draw a selection on the screenshot to extract text
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {results.map((entry, i) => (
                <div key={entry.timestamp} className="px-3 py-2 hover:bg-accent/40 group">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs text-muted-foreground/50 font-medium">{entry.confidence.toFixed(0)}%</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs ml-auto opacity-0 group-hover:opacity-100"
                      onClick={() => copyText(entry.text, i)}
                    >
                      {copied === i ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <div className="text-base leading-relaxed">
                    <TokenizedText text={entry.text} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Tab bar */}
      <nav className="flex items-center gap-1 px-2 border-b border-border bg-card shrink-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-3 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {tab === t.key && (
              <span className="absolute bottom-0 left-1 right-1 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "capture" && (
          <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-3 py-2 bg-card/60 border-b border-border shrink-0">
              <Button
                size="sm"
                onClick={handleCapture}
                disabled={capturing}
              >
                {capturing ? "Capturing..." : "Capture"}
              </Button>
              <kbd className="text-xs text-muted-foreground/60 font-mono bg-muted px-1.5 py-0.5 rounded">
                {hotkeyLabel}
              </kbd>

              {screenshotUrl && (
                <div className="flex items-center gap-1.5 ml-auto">
                  {processing && <span className="text-sm text-primary animate-pulse mr-2">Reading text...</span>}
                  {error && <span className="text-sm text-destructive mr-2 truncate max-w-[250px]" title={error}>{error}</span>}
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-xs" onClick={() => doZoom(zoom / 1.25)} title="Zoom out">−</Button>
                  <button
                    onClick={() => { setZoom(calcFit()); setIsFit(true); }}
                    className={`px-2 py-0.5 text-xs font-mono rounded-md transition-colors ${
                      isFit ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                    title="Fit to screen"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-xs" onClick={() => doZoom(zoom * 1.25)} title="Zoom in">+</Button>
                </div>
              )}
              {!screenshotUrl && error && <span className="text-sm text-destructive ml-auto">{error}</span>}
            </div>

            {/* Image + side panel */}
            <div className="flex-1 min-h-0 flex">
              {panelSide === "left" && (
                <>
                  {renderResultsPanel("left")}
                  <div
                    className="w-px bg-border hover:bg-primary hover:w-0.5 cursor-col-resize shrink-0 transition-all"
                    onMouseDown={handleResizeStart}
                  />
                </>
              )}

              <div
                ref={containerRef}
                className="flex-1 min-w-0 overflow-auto scrollbar-visible"
                style={{
                  cursor: isPanning ? "grabbing" : screenshotUrl ? "crosshair" : "default",
                  backgroundColor: "var(--color-canvas)",
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onContextMenu={(e) => e.preventDefault()}
              >
                {screenshotUrl ? (
                  <div
                    className="relative"
                    style={{ width: dispW, height: dispH }}
                  >
                    <img
                      ref={imgRef}
                      src={screenshotUrl}
                      alt="Screenshot"
                      draggable={false}
                      onLoad={onImageLoad}
                      onDragStart={(e) => e.preventDefault()}
                      style={{
                        width: dispW,
                        height: dispH,
                        display: "block",
                        userSelect: "none",
                        WebkitUserDrag: "none",
                        pointerEvents: "none",
                      } as React.CSSProperties}
                    />
                    {selRect && selRect.width > 0 && selRect.height > 0 && (
                      <div
                        className="absolute border-2 border-primary bg-primary/10 pointer-events-none"
                        style={{ left: selRect.left, top: selRect.top, width: selRect.width, height: selRect.height }}
                      />
                    )}
                    {!region && !processing && (
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm text-muted-foreground text-xs px-3 py-1.5 rounded-full pointer-events-none z-10 shadow-sm border border-border/50">
                        Drag to select · Scroll to zoom · Right-drag to pan
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <span className="text-muted-foreground/20 text-4xl">&#x2318;</span>
                    <p className="text-sm text-muted-foreground">
                      {capturing ? "Taking screenshot..." : "Press Capture to start reading"}
                    </p>
                    <kbd className="text-xs text-muted-foreground/50 font-mono bg-muted px-2 py-1 rounded">
                      {hotkeyLabel}
                    </kbd>
                  </div>
                )}
              </div>

              {panelSide === "right" && (
                <>
                  <div
                    className="w-px bg-border hover:bg-primary hover:w-0.5 cursor-col-resize shrink-0 transition-all"
                    onMouseDown={handleResizeStart}
                  />
                  {renderResultsPanel("right")}
                </>
              )}
            </div>
          </div>
        )}

        {tab === "history" && <HistoryView />}
        {tab === "cards" && <CardsView />}
        {tab === "tags" && <TagsView />}
        {tab === "settings" && <SettingsView />}
      </div>
    </div>
  );
}
