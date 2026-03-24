import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri, convertFileSrc } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import type { OcrResult } from "../../types/ocr";

interface Region {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export default function CaptureOverlay() {
  const [isDragging, setIsDragging] = useState(false);
  const [region, setRegion] = useState<Region | null>(null);
  const [processing, setProcessing] = useState(false);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  // Load the pre-captured screenshot as background
  useEffect(() => {
    async function loadBg() {
      console.log("[CaptureOverlay] mounted, isTauri:", isTauri());
      if (!isTauri()) {
        setOverlayError("Not running in Tauri webview");
        return;
      }
      try {
        const path = await invoke<string>("get_capture_bg_path");
        console.log("[CaptureOverlay] bg path:", path);
        const url = convertFileSrc(path);
        console.log("[CaptureOverlay] bg url:", url);
        setBgUrl(url);
      } catch (err) {
        console.error("[CaptureOverlay] Failed to load capture background:", err);
        setOverlayError("Failed to load screenshot: " + String(err));
      }
    }
    loadBg();
  }, []);

  // Once background image loads, draw it on canvas
  useEffect(() => {
    if (!bgUrl) return;
    const img = new Image();
    img.onload = () => {
      console.log("[CaptureOverlay] bg image loaded:", img.naturalWidth, "x", img.naturalHeight);
      bgImageRef.current = img;
      drawOverlay();
    };
    img.onerror = (e) => {
      console.error("[CaptureOverlay] bg image failed to load:", e);
      setOverlayError("Failed to load screenshot image");
    };
    img.src = bgUrl;
  }, [bgUrl]);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      invoke("close_capture_overlay");
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  useEffect(() => {
    drawOverlay();
  }, [region, isDragging, processing]);

  function drawOverlay() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Draw the pre-captured screenshot as background
    const bg = bgImageRef.current;
    if (bg) {
      ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    }

    // Dim the entire screen
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (processing) {
      ctx.font = "18px sans-serif";
      ctx.fillStyle = "#3b82f6";
      ctx.textAlign = "center";
      ctx.fillText("Processing OCR...", canvas.width / 2, canvas.height / 2);
      return;
    }

    if (region) {
      const x = Math.min(region.startX, region.endX);
      const y = Math.min(region.startY, region.endY);
      const w = Math.abs(region.endX - region.startX);
      const h = Math.abs(region.endY - region.startY);

      // Draw the clear (un-dimmed) selected region from the background
      if (bg) {
        const scaleX = bg.naturalWidth / canvas.width;
        const scaleY = bg.naturalHeight / canvas.height;
        ctx.drawImage(
          bg,
          x * scaleX, y * scaleY, w * scaleX, h * scaleY,
          x, y, w, h
        );
      } else {
        ctx.clearRect(x, y, w, h);
      }

      // Draw selection border
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      // Dimension label
      if (w > 50 && h > 25) {
        const label = `${Math.round(w)} × ${Math.round(h)}`;
        ctx.font = "12px monospace";
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(x + 2, y + h - 20, ctx.measureText(label).width + 8, 18);
        ctx.fillStyle = "#3b82f6";
        ctx.textAlign = "left";
        ctx.fillText(label, x + 6, y + h - 6);
      }
    }

    // Hint text
    if (!region && !processing) {
      ctx.font = "14px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.textAlign = "center";
      ctx.fillText("Drag to select region · Esc to cancel", canvas.width / 2, 40);
    }
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (processing) return;
    setIsDragging(true);
    setRegion({
      startX: e.clientX,
      startY: e.clientY,
      endX: e.clientX,
      endY: e.clientY,
    });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging || !region) return;
    setRegion((prev) =>
      prev ? { ...prev, endX: e.clientX, endY: e.clientY } : null
    );
  }

  async function handleMouseUp() {
    if (!isDragging || !region) return;
    setIsDragging(false);

    const x = Math.min(region.startX, region.endX);
    const y = Math.min(region.startY, region.endY);
    const w = Math.abs(region.endX - region.startX);
    const h = Math.abs(region.endY - region.startY);

    if (w < 10 || h < 10) {
      setRegion(null);
      return;
    }

    // Scale to actual image pixels (DPR)
    const bg = bgImageRef.current;
    const canvas = canvasRef.current;
    const scaleX = bg && canvas ? bg.naturalWidth / canvas.width : 1;
    const scaleY = bg && canvas ? bg.naturalHeight / canvas.height : 1;

    setProcessing(true);

    try {
      console.log("[CaptureOverlay] cropping region:", { x: Math.round(x * scaleX), y: Math.round(y * scaleY), width: Math.round(w * scaleX), height: Math.round(h * scaleY) });
      const imagePath = await invoke<string>("crop_and_save", {
        x: Math.round(x * scaleX),
        y: Math.round(y * scaleY),
        width: Math.round(w * scaleX),
        height: Math.round(h * scaleY),
      });
      console.log("[CaptureOverlay] cropped to:", imagePath);

      console.log("[CaptureOverlay] running OCR...");
      const ocrResult = await invoke<OcrResult>("run_ocr", {
        imagePath,
        preset: "default_ui",
      });
      console.log("[CaptureOverlay] OCR result:", ocrResult);

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
        console.log("[CaptureOverlay] capture saved to DB");
      } catch (saveErr) {
        console.error("[CaptureOverlay] Failed to save capture:", saveErr);
      }

      await emit("ocr-result", {
        imagePath,
        ocrResult,
        preset: "default_ui",
      });
      console.log("[CaptureOverlay] emitted ocr-result event");
    } catch (err) {
      console.error("[CaptureOverlay] Capture/OCR failed:", err);
      setOverlayError("Capture/OCR failed: " + String(err));
      await emit("ocr-result", {
        imagePath: "",
        ocrResult: {
          raw_text: "",
          normalized_text: "",
          confidence: 0,
          error: String(err),
        },
        preset: "default_ui",
      });
    }
  }

  // Show errors visibly on screen (since console isn't accessible in fullscreen overlay)
  if (overlayError) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="bg-red-900/80 border border-red-500 rounded-lg p-6 max-w-lg text-center">
          <p className="text-red-200 text-lg font-bold mb-2">Capture Error</p>
          <p className="text-red-300 text-sm mb-4">{overlayError}</p>
          <button
            onClick={() => invoke("close_capture_overlay")}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-sm font-medium"
          >
            Close (Esc)
          </button>
        </div>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-screen h-screen"
      style={{ cursor: processing ? "wait" : "crosshair", background: "#000" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    />
  );
}
