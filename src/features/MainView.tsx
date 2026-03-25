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

  // Results
  const [results, setResults] = useState<CaptureEntry[]>([]);
  const [copied, setCopied] = useState<number | null>(null);

  // Side panel
  const [panelWidth, setPanelWidth] = useState(200);
  const [panelSide, setPanelSide] = useState<"left" | "right">("right");

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
    // Calc initial fit
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

  // Displayed pixel size
  const dispW = natW * zoom;
  const dispH = natH * zoom;

  // Mouse coords relative to img element
  function getImageCoords(e: React.MouseEvent) {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handleMouseDown(e: React.MouseEvent) {
    // Middle click -> reset to 100%
    if (e.button === 1) {
      e.preventDefault();
      setZoom(1);
      setIsFit(false);
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
    if (!isDragging || !region) return;
    e.preventDefault();
    const { x, y } = getImageCoords(e);
    setRegion(prev => prev ? { ...prev, endX: x, endY: y } : null);
  }

  async function handleMouseUp() {
    if (!isDragging || !region) return;
    setIsDragging(false);

    const x = Math.min(region.startX, region.endX);
    const y = Math.min(region.startY, region.endY);
    const w = Math.abs(region.endX - region.startX);
    const h = Math.abs(region.endY - region.startY);

    if (w < 10 || h < 10) { setRegion(null); return; }

    // displayed → native pixels
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
        className={`flex flex-col shrink-0 overflow-hidden bg-neutral-900 ${
          side === "left" ? "border-r" : "border-l"
        } border-neutral-700`}
      >
        <div className="px-2 py-1 bg-neutral-800 border-b border-neutral-700 shrink-0">
          <span className="text-[11px] text-neutral-500 font-medium">
            OCR Results ({results.length})
          </span>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-visible">
          {results.length === 0 ? (
            <div className="flex items-center justify-center h-full text-neutral-600 text-[11px] p-2 text-center">
              Select a region to extract text
            </div>
          ) : (
            <div className="divide-y divide-neutral-800">
              {results.map((entry, i) => (
                <div key={entry.timestamp} className="px-2 py-1.5 hover:bg-neutral-800/50">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-[10px] text-neutral-600">{entry.confidence.toFixed(0)}%</span>
                    <button
                      onClick={() => copyText(entry.text, i)}
                      className="px-1.5 text-[10px] bg-neutral-700 hover:bg-neutral-600 rounded transition-colors ml-auto"
                    >
                      {copied === i ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="text-xs">
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
    <div className="flex flex-col h-screen bg-neutral-900 text-neutral-100">
      {/* Top tab bar */}
      <nav className="flex border-b border-neutral-700 bg-neutral-800 shrink-0">
        {(Object.keys(tabLabels) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              tab === t
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-neutral-400 hover:text-neutral-200"
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
            <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 border-b border-neutral-700 shrink-0">
              <button
                onClick={handleCapture}
                disabled={capturing}
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded font-medium transition-colors"
              >
                {capturing ? "Capturing..." : "Capture"}
              </button>
              <span className="text-[14px] text-neutral-500">Ctrl+Shift+X</span>

              {screenshotUrl && (
                <div className="flex items-center gap-1 ml-auto">
                  {processing && <span className="text-xs text-blue-400 mr-2">Processing OCR...</span>}
                  {error && <span className="text-xs text-red-400 mr-2 truncate max-w-[250px]" title={error}>{error}</span>}
                  <button onClick={() => doZoom(zoom / 1.25)} className="px-1.5 py-0.5 text-xs bg-neutral-700 hover:bg-neutral-600 rounded" title="Zoom out">-</button>
                  <button
                    onClick={() => { setZoom(calcFit()); setIsFit(true); }}
                    className={`px-2 py-0.5 text-[14px] rounded ${isFit ? "bg-blue-600 text-white" : "bg-neutral-700 hover:bg-neutral-600 text-neutral-300"}`}
                    title="Fit to screen"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button onClick={() => doZoom(zoom * 1.25)} className="px-1.5 py-0.5 text-xs bg-neutral-700 hover:bg-neutral-600 rounded" title="Zoom in">+</button>
                </div>
              )}
              {!screenshotUrl && error && <span className="text-xs text-red-400 ml-auto">{error}</span>}
            </div>

            {/* Image + side panel */}
            <div className="flex-1 min-h-0 flex">
              {panelSide === "left" && (
                <>
                  {renderResultsPanel("left")}
                  <div
                    className="w-1 bg-neutral-700 hover:bg-blue-500 cursor-col-resize shrink-0 transition-colors"
                    onMouseDown={handleResizeStart}
                  />
                </>
              )}

              {/* Image area */}
              <div
                ref={containerRef}
                className="flex-1 min-w-0 overflow-auto bg-neutral-950 scrollbar-visible"
                style={{ cursor: screenshotUrl ? "crosshair" : "default" }}
                onMouseDown={(e) => {
                  if (e.button === 1) { e.preventDefault(); setZoom(1); setIsFit(false); }
                }}
              >
                {screenshotUrl ? (
                  <div
                    className="relative"
                    style={{ width: dispW, height: dispH }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
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
                        className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
                        style={{ left: selRect.left, top: selRect.top, width: selRect.width, height: selRect.height }}
                      />
                    )}
                    {!region && !processing && (
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 text-white/70 text-xs px-3 py-1 rounded pointer-events-none z-10">
                        Drag to select · Scroll to zoom · Middle-click 100%
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
                    {capturing ? "Taking screenshot..." : "Press Capture or Ctrl+Shift+X"}
                  </div>
                )}
              </div>

              {panelSide === "right" && (
                <>
                  <div
                    className="w-1 bg-neutral-700 hover:bg-blue-500 cursor-col-resize shrink-0 transition-colors"
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
