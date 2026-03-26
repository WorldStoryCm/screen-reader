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

  // Screenshot
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image natural dimensions (set on load)
  const [natW, setNatW] = useState(0);
  const [natH, setNatH] = useState(0);

  // Zoom
  const [zoom, setZoom] = useState(1);
  const [isFit, setIsFit] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Selection
  const [isDragging, setIsDragging] = useState(false);
  const [region, setRegion] = useState<Region | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Right-click pan
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, scrollX: 0, scrollY: 0 });

  // Results
  const [results, setResults] = useState<CaptureEntry[]>([]);
  const [copied, setCopied] = useState<number | null>(null);

  // Side panel
  const [panelWidth, setPanelWidth] = useState(200);
  const [panelSide, setPanelSide] = useState<"left" | "right">("right");

  // Hotkey display
  const [hotkeyLabel, setHotkeyLabel] = useState("Ctrl+Shift+X");

  // Refs for non-passive wheel listener
  const hasScreenshot = useRef(false);
  hasScreenshot.current = !!screenshotUrl;

  // Hotkey listener
  useEffect(() => {
    const unlisten = listen("trigger-capture", () => handleCapture());
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // Recalc fit zoom on container resize
  useEffect(() => {
    const c = containerRef.current;
    if (!c || !natW) return;
    const ro = new ResizeObserver(() => { if (isFit) setZoom(calcFit()); });
    ro.observe(c);
    return () => ro.disconnect();
  }, [natW, natH, isFit]);

  // Load hotkey label
  useEffect(() => {
    invoke<string | null>("get_setting", { key: "hotkey" })
      .then(v => { if (v) setHotkeyLabel(v); })
      .catch(() => {});
    const unlisten = listen<string>("hotkey-changed", (e) => {
      setHotkeyLabel(e.payload);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // Load panel side preference
  useEffect(() => {
    invoke<string | null>("get_setting", { key: "ocr_panel_side" })
      .then(v => { if (v === "left" || v === "right") setPanelSide(v); })
      .catch(() => {});
    const unlisten = listen<string>("panel-side-changed", (e) => {
      if (e.payload === "left" || e.payload === "right") setPanelSide(e.payload);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // Native wheel listener (non-passive to allow preventDefault)
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
          setError("OCR returned no text for this region");
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

  const tabLabels: Record<Tab, string> = {
    capture: "Screen Reader",
    cards: "Cards",
    tags: "Tags",
    history: "History",
    settings: "Settings",
  };

  function renderResultsPanel(side: "left" | "right") {
    return (
      <div
        style={{ width: panelWidth }}
        className={`flex flex-col shrink-0 overflow-hidden bg-background ${
          side === "left" ? "border-r" : "border-l"
        } border-border`}
      >
        <div className="px-2 py-1 bg-card border-b border-border shrink-0">
          <span className="text-xs text-muted-foreground font-medium">
            OCR Results ({results.length})
          </span>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-visible">
          {results.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-xs p-2 text-center">
              Select a region to extract text
            </div>
          ) : (
            <div className="divide-y divide-border">
              {results.map((entry, i) => (
                <div key={entry.timestamp} className="px-2 py-1.5 hover:bg-accent/50">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-[10px] text-muted-foreground/60">{entry.confidence.toFixed(0)}%</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-5 px-1.5 text-[10px] ml-auto"
                      onClick={() => copyText(entry.text, i)}
                    >
                      {copied === i ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <div>
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
      {/* Top tab bar */}
      <nav className="flex border-b border-border bg-card shrink-0">
        {(Object.keys(tabLabels) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tabLabels[t]}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "capture" && (
          <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-card border-b border-border shrink-0">
              <Button
                size="sm"
                onClick={handleCapture}
                disabled={capturing}
              >
                {capturing ? "Capturing..." : "Capture"}
              </Button>
              <span className="text-xs text-muted-foreground">{hotkeyLabel}</span>

              {screenshotUrl && (
                <div className="flex items-center gap-1 ml-auto">
                  {processing && <span className="text-sm text-primary mr-2">Processing OCR...</span>}
                  {error && <span className="text-sm text-destructive mr-2 truncate max-w-[250px]" title={error}>{error}</span>}
                  <Button variant="secondary" size="sm" className="h-6 px-1.5" onClick={() => doZoom(zoom / 1.25)} title="Zoom out">-</Button>
                  <Button
                    variant={isFit ? "default" : "secondary"}
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => { setZoom(calcFit()); setIsFit(true); }}
                    title="Fit to screen"
                  >
                    {Math.round(zoom * 100)}%
                  </Button>
                  <Button variant="secondary" size="sm" className="h-6 px-1.5" onClick={() => doZoom(zoom * 1.25)} title="Zoom in">+</Button>
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
                    className="w-1 bg-border hover:bg-primary cursor-col-resize shrink-0 transition-colors"
                    onMouseDown={handleResizeStart}
                  />
                </>
              )}

              {/* Image area */}
              <div
                ref={containerRef}
                className="flex-1 min-w-0 overflow-auto bg-background scrollbar-visible"
                style={{ cursor: isPanning ? "grabbing" : screenshotUrl ? "crosshair" : "default" }}
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
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 text-white/70 text-xs px-3 py-1 rounded pointer-events-none z-10">
                        Drag to select · Scroll to zoom · Right-drag to pan · Middle-click 100%
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    {capturing ? "Taking screenshot..." : `Press Capture or ${hotkeyLabel}`}
                  </div>
                )}
              </div>

              {panelSide === "right" && (
                <>
                  <div
                    className="w-1 bg-border hover:bg-primary cursor-col-resize shrink-0 transition-colors"
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
