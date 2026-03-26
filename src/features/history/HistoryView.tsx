import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Capture, Tag } from "../../types/capture";
import type { OcrResult } from "../../types/ocr";
import TokenizedText from "../capture/TokenizedText";
import { PRESETS } from "../../types/capture";
import { Button } from "@/components/button";
import { Label } from "@/components/label";
import { Textarea } from "@/components/textarea";
import { ScrollArea } from "@/components/scroll-area";
import { Separator } from "@/components/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/select";

interface DateGroup {
  label: string;
  captures: Capture[];
}

function groupByDate(captures: Capture[]): DateGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);

  const groups = new Map<string, Capture[]>();

  for (const capture of captures) {
    const secs = parseFloat(capture.created_at);
    const date = isNaN(secs) ? new Date() : new Date(secs * 1000);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    let label: string;
    if (dayStart.getTime() === today.getTime()) {
      label = "Today";
    } else if (dayStart.getTime() === yesterday.getTime()) {
      label = "Yesterday";
    } else {
      label = dayStart.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: dayStart.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(capture);
  }

  return Array.from(groups.entries()).map(([label, captures]) => ({
    label,
    captures,
  }));
}

export default function HistoryView() {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selected, setSelected] = useState<Capture | null>(null);
  const [filterTag, _setFilterTag] = useState<string | null>(null);
  void _setFilterTag;
  const [loading, setLoading] = useState(true);

  // Edit states
  const [editNote, setEditNote] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [rerunPreset, setRerunPreset] = useState("");
  const [rerunning, setRerunning] = useState(false);
  const [showTokens, setShowTokens] = useState(false);

  const loadCaptures = useCallback(async () => {
    try {
      const list = await invoke<Capture[]>("list_captures", {
        limit: 200,
        offset: 0,
        tag: filterTag,
      });
      setCaptures(list);
    } catch (err) {
      console.error("Failed to load captures:", err);
    } finally {
      setLoading(false);
    }
  }, [filterTag]);

  const loadTags = useCallback(async () => {
    try {
      const tags = await invoke<Tag[]>("list_tags");
      setAllTags(tags);
    } catch (err) {
      console.error("Failed to load tags:", err);
    }
  }, []);

  useEffect(() => {
    loadCaptures();
    loadTags();
  }, [loadCaptures, loadTags]);

  function selectCapture(capture: Capture) {
    setSelected(capture);
    setEditNote(capture.note || "");
    setEditTags([...capture.tags]);
    setRerunPreset(capture.preprocess_preset);
  }

  async function handleDelete(id: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    await invoke("delete_capture", { id });
    setCaptures((prev) => prev.filter((c) => c.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  async function handleSaveNote() {
    if (!selected) return;
    await invoke("update_capture_note", {
      captureId: selected.id,
      note: editNote,
    });
    setSelected({ ...selected, note: editNote });
    setCaptures((prev) =>
      prev.map((c) => (c.id === selected.id ? { ...c, note: editNote } : c))
    );
  }

  async function handleSaveTags() {
    if (!selected) return;
    await invoke("update_capture_tags", {
      captureId: selected.id,
      tagNames: editTags,
    });
    setSelected({ ...selected, tags: editTags });
    setCaptures((prev) =>
      prev.map((c) => (c.id === selected.id ? { ...c, tags: editTags } : c))
    );
  }

  function toggleTag(tagName: string) {
    setEditTags((prev) =>
      prev.includes(tagName)
        ? prev.filter((t) => t !== tagName)
        : [...prev, tagName]
    );
  }

  async function handleRerunOcr() {
    if (!selected) return;
    setRerunning(true);
    try {
      const result = await invoke<OcrResult>("run_ocr", {
        imagePath: selected.image_path,
        preset: rerunPreset,
      });
      await invoke("update_capture_ocr", {
        captureId: selected.id,
        ocrText: result.raw_text,
        normalizedText: result.normalized_text,
        preprocessPreset: rerunPreset,
        confidence: result.confidence,
      });
      const updated = {
        ...selected,
        ocr_text: result.raw_text,
        normalized_text: result.normalized_text,
        preprocess_preset: rerunPreset,
        confidence: result.confidence,
      };
      setSelected(updated);
      setCaptures((prev) =>
        prev.map((c) => (c.id === selected.id ? updated : c))
      );
    } catch (err) {
      console.error("OCR rerun failed:", err);
    } finally {
      setRerunning(false);
    }
  }

  function formatTime(timestamp: string) {
    const secs = parseFloat(timestamp);
    if (isNaN(secs)) return timestamp;
    return new Date(secs * 1000).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function truncate(text: string, maxLen: number) {
    return text.length <= maxLen ? text : text.slice(0, maxLen) + "...";
  }

  const dateGroups = groupByDate(captures);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left: list */}
      <div className="w-1/2 min-w-0 border-r border-border flex flex-col">
        {/* Capture list grouped by date */}
        <ScrollArea className="flex-1">
          {captures.length === 0 ? (
            <div className="p-4 text-muted-foreground text-sm text-center">
              {filterTag ? `No captures tagged "${filterTag}"` : "No captures yet"}
            </div>
          ) : (
            dateGroups.map((group) => (
              <div key={group.label}>
                <div className="px-3 py-1.5 border-b border-border sticky top-0 z-10 bg-card">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {group.label}
                  </span>
                </div>
                {group.captures.map((capture) => (
                  <div
                    key={capture.id}
                    onClick={() => selectCapture(capture)}
                    className={`group p-3 border-b border-border cursor-pointer transition-colors ${
                      selected?.id === capture.id
                        ? "bg-accent"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs text-muted-foreground">
                        {formatTime(capture.created_at)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground/60">
                          {capture.confidence.toFixed(0)}%
                        </span>
                        <button
                          onClick={(e) => handleDelete(capture.id, e)}
                          className="text-base px-2 text-destructive opacity-0 group-hover:opacity-100 transition-all"
                          title="Delete"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-secondary-foreground leading-relaxed">
                      {truncate(capture.normalized_text || capture.ocr_text, 80)}
                    </p>
                    {capture.tags.length > 0 && (
                      <div className="flex gap-1 mt-1 overflow-x-auto scrollbar-visible">
                        {capture.tags.map((t) => (
                          <span
                            key={t}
                            className="text-xs px-1.5 py-0.5 bg-primary/20 text-primary rounded-full whitespace-nowrap shrink-0"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Right: detail */}
      <div className="w-1/2 overflow-y-auto">
        {selected ? (
          <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {(() => {
                  const secs = parseFloat(selected.created_at);
                  return isNaN(secs) ? selected.created_at : new Date(secs * 1000).toLocaleString();
                })()}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    writeText(selected.normalized_text || selected.ocr_text)
                  }
                >
                  Copy
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(selected.id)}
                >
                  Delete
                </Button>
              </div>
            </div>

            <Separator />

            {/* OCR text */}
            <div>
              <div className="flex gap-2 mb-2">
                <Button
                  variant={!showTokens ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setShowTokens(false)}
                >
                  Raw
                </Button>
                <Button
                  variant={showTokens ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setShowTokens(true)}
                >
                  Tokens
                </Button>
              </div>
              <div className="bg-card rounded-md p-3 border border-border">
                {showTokens ? (
                  <TokenizedText
                    text={selected.normalized_text || selected.ocr_text}
                    captureId={selected.id}
                  />
                ) : (
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed font-mono">
                    {selected.normalized_text || selected.ocr_text || "(empty)"}
                  </p>
                )}
              </div>
            </div>

            {/* OCR retry */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Rerun OCR with preset</Label>
              <div className="flex gap-2">
                <Select value={rerunPreset} onValueChange={setRerunPreset}>
                  <SelectTrigger className="flex-1">
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
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRerunOcr}
                  disabled={rerunning}
                >
                  {rerunning ? "Running..." : "Rerun"}
                </Button>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Tags</Label>
              <div className="flex gap-1 overflow-x-auto scrollbar-visible pb-1">
                {allTags.map((tag) => (
                  <Button
                    key={tag.id}
                    variant={editTags.includes(tag.name) ? "default" : "secondary"}
                    size="sm"
                    className="h-7 text-xs shrink-0"
                    onClick={() => toggleTag(tag.name)}
                  >
                    {tag.name}
                  </Button>
                ))}
              </div>
              {JSON.stringify(editTags) !==
                JSON.stringify(selected.tags) && (
                <Button
                  size="sm"
                  className="bg-emerald-700 hover:bg-emerald-600 text-white"
                  onClick={handleSaveTags}
                >
                  Save tags
                </Button>
              )}
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Note</Label>
              <Textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                onBlur={handleSaveNote}
                rows={3}
                className="resize-none"
                placeholder="Add a note..."
              />
            </div>

            {/* Meta */}
            <div className="text-xs text-muted-foreground/60 space-y-0.5">
              <p>Preset: {selected.preprocess_preset}</p>
              <p>Engine: {selected.ocr_engine}</p>
              <p>Confidence: {selected.confidence.toFixed(1)}%</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a capture to view details
          </div>
        )}
      </div>
    </div>
  );
}
