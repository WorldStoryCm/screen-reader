import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Capture, Tag } from "../../types/capture";
import type { OcrResult } from "../../types/ocr";
import TokenizedText from "../capture/TokenizedText";
import type { Token } from "../../lib/tokenizer";
import { PRESETS } from "../../types/capture";

export default function HistoryView() {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selected, setSelected] = useState<Capture | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit states
  const [editNote, setEditNote] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [rerunPreset, setRerunPreset] = useState("");
  const [rerunning, setRerunning] = useState(false);
  const [showTokens, setShowTokens] = useState(false);
  const [cardJp, setCardJp] = useState<string | null>(null);

  const loadCaptures = useCallback(async () => {
    try {
      const list = await invoke<Capture[]>("list_captures", {
        limit: 100,
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

  async function handleDelete(id: string) {
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
    return new Date(secs * 1000).toLocaleString();
  }

  function truncate(text: string, maxLen: number) {
    return text.length <= maxLen ? text : text.slice(0, maxLen) + "...";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left: list */}
      <div className="w-1/2 border-r border-neutral-700 flex flex-col">
        {/* Tag filter bar */}
        <div className="flex gap-1 p-2 border-b border-neutral-800 overflow-x-auto shrink-0">
          <button
            onClick={() => setFilterTag(null)}
            className={`px-2 py-0.5 text-[10px] rounded whitespace-nowrap transition-colors ${
              filterTag === null
                ? "bg-blue-600 text-white"
                : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setFilterTag(tag.name)}
              className={`px-2 py-0.5 text-[10px] rounded whitespace-nowrap transition-colors ${
                filterTag === tag.name
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
              }`}
            >
              {tag.name}
            </button>
          ))}
        </div>

        {/* Capture list */}
        <div className="flex-1 overflow-y-auto">
          {captures.length === 0 ? (
            <div className="p-4 text-neutral-500 text-sm text-center">
              {filterTag ? `No captures tagged "${filterTag}"` : "No captures yet"}
            </div>
          ) : (
            captures.map((capture) => (
              <div
                key={capture.id}
                onClick={() => selectCapture(capture)}
                className={`p-3 border-b border-neutral-800 cursor-pointer transition-colors ${
                  selected?.id === capture.id
                    ? "bg-neutral-800"
                    : "hover:bg-neutral-800/50"
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[10px] text-neutral-500">
                    {formatTime(capture.created_at)}
                  </span>
                  <span className="text-[10px] text-neutral-600">
                    {capture.confidence.toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  {truncate(capture.normalized_text || capture.ocr_text, 80)}
                </p>
                {capture.tags.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {capture.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-1.5 py-0.5 bg-blue-900/40 text-blue-300 rounded"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: detail */}
      <div className="w-1/2 overflow-y-auto">
        {selected ? (
          <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
              <span className="text-xs text-neutral-500">
                {formatTime(selected.created_at)}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    writeText(selected.normalized_text || selected.ocr_text)
                  }
                  className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded transition-colors"
                >
                  Copy
                </button>
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="px-2 py-1 text-xs bg-red-900/50 hover:bg-red-800/50 text-red-400 rounded transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* OCR text */}
            <div>
              <div className="flex gap-2 mb-1">
                <button onClick={() => setShowTokens(false)}
                  className={`text-[10px] px-2 py-0.5 rounded transition-colors ${!showTokens ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-400"}`}>
                  Raw
                </button>
                <button onClick={() => setShowTokens(true)}
                  className={`text-[10px] px-2 py-0.5 rounded transition-colors ${showTokens ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-400"}`}>
                  Tokens
                </button>
              </div>
              <div className="bg-neutral-800 rounded p-3">
                {showTokens ? (
                  <TokenizedText
                    text={selected.normalized_text || selected.ocr_text}
                    onTokenSelect={(token: Token) => setCardJp(token.surface)}
                  />
                ) : (
                  <p className="text-sm text-neutral-200 whitespace-pre-wrap leading-relaxed font-mono">
                    {selected.normalized_text || selected.ocr_text || "(empty)"}
                  </p>
                )}
              </div>
            </div>

            {/* Quick card creation from token */}
            {cardJp && (
              <QuickCardForm
                jpText={cardJp}
                captureId={selected.id}
                onClose={() => setCardJp(null)}
              />
            )}

            {/* OCR retry */}
            <div>
              <label className="block text-[10px] text-neutral-500 mb-1">
                Rerun OCR with preset
              </label>
              <div className="flex gap-2">
                <select
                  value={rerunPreset}
                  onChange={(e) => setRerunPreset(e.target.value)}
                  className="flex-1 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-xs text-neutral-300"
                >
                  {PRESETS.map((p) => (
                    <option key={p} value={p}>
                      {p.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleRerunOcr}
                  disabled={rerunning}
                  className="px-3 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 rounded transition-colors"
                >
                  {rerunning ? "Running..." : "Rerun"}
                </button>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-[10px] text-neutral-500 mb-1">
                Tags
              </label>
              <div className="flex flex-wrap gap-1 mb-2">
                {allTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.name)}
                    className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                      editTags.includes(tag.name)
                        ? "bg-blue-600 text-white"
                        : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
              {JSON.stringify(editTags) !==
                JSON.stringify(selected.tags) && (
                <button
                  onClick={handleSaveTags}
                  className="px-2 py-1 text-[10px] bg-green-700 hover:bg-green-600 rounded transition-colors"
                >
                  Save tags
                </button>
              )}
            </div>

            {/* Note */}
            <div>
              <label className="block text-[10px] text-neutral-500 mb-1">
                Note
              </label>
              <textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                onBlur={handleSaveNote}
                rows={3}
                className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-xs text-neutral-300 resize-none"
                placeholder="Add a note..."
              />
            </div>

            {/* Meta */}
            <div className="text-[10px] text-neutral-600 space-y-0.5">
              <p>Preset: {selected.preprocess_preset}</p>
              <p>Engine: {selected.ocr_engine}</p>
              <p>Confidence: {selected.confidence.toFixed(1)}%</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
            Select a capture to view details
          </div>
        )}
      </div>
    </div>
  );
}

function QuickCardForm({
  jpText,
  captureId,
  onClose,
}: {
  jpText: string;
  captureId: string;
  onClose: () => void;
}) {
  const [reading, setReading] = useState("");
  const [meaning, setMeaning] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    try {
      await invoke("create_card", {
        input: {
          jp_text: jpText,
          reading,
          meaning,
          note: null,
          source_capture_id: captureId,
          source_text_fragment: jpText,
          tags: [],
        },
      });
      setSaved(true);
      setTimeout(onClose, 1000);
    } catch (err) {
      console.error("Failed to create card:", err);
    }
  }

  if (saved) {
    return (
      <div className="bg-green-900/30 border border-green-800 rounded p-3 text-green-400 text-xs">
        Card saved!
      </div>
    );
  }

  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded p-3 space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-neutral-300">
          Create card: <span className="text-blue-400">{jpText}</span>
        </span>
        <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300 text-sm">×</button>
      </div>
      <input
        value={reading}
        onChange={(e) => setReading(e.target.value)}
        placeholder="Reading (e.g. にほんご)"
        className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-neutral-300"
      />
      <input
        value={meaning}
        onChange={(e) => setMeaning(e.target.value)}
        placeholder="Meaning"
        className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-neutral-300"
      />
      <button
        onClick={handleSave}
        disabled={!reading && !meaning}
        className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded font-medium transition-colors"
      >
        Save Card
      </button>
    </div>
  );
}
