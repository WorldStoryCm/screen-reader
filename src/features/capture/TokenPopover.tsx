import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Card, CreateCardInput } from "../../types/card";
import { getCardLevel, LEVELS, LEVEL_LABELS, LEVEL_COLORS, LEVEL_ROMAN } from "../../types/card";
import type { Token } from "../../lib/tokenizer";

interface Props {
  token: Token;
  anchorRect: { left: number; top: number; bottom: number };
  captureId?: string;
  onClose: () => void;
  onCardCreated?: () => void;
}

export default function TokenPopover({
  token,
  anchorRect,
  captureId,
  onClose,
  onCardCreated,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [copied, setCopied] = useState(false);

  // Create card form
  const [reading, setReading] = useState("");
  const [translation, setTranslation] = useState("");
  const [meaning, setMeaning] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    invoke<Card | null>("find_card_by_text", { text: token.surface })
      .then((found) => {
        setCard(found);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token.surface]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleCopy() {
    await writeText(token.surface);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  }

  async function handleCreateCard() {
    setSaving(true);
    try {
      const input: CreateCardInput = {
        jp_text: token.surface,
        reading,
        meaning,
        translation: translation || null,
        note: null,
        category: null,
        source_capture_id: captureId || null,
        source_text_fragment: token.surface,
        tags: [],
      };
      const newCard = await invoke<Card>("create_card", { input });
      setCard(newCard);
      setShowCreate(false);
      onCardCreated?.();
    } catch (err) {
      console.error("Failed to create card:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleLevelChange(level: number) {
    if (!card) return;
    try {
      await invoke("update_card", { id: card.id, status: String(level) });
      setCard({ ...card, status: String(level) });
    } catch (err) {
      console.error("Failed to update level:", err);
    }
  }

  // Position popover below the token, keep on screen
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.min(Math.max(4, anchorRect.left - 140), window.innerWidth - 270),
    top: Math.min(anchorRect.bottom + 4, window.innerHeight - 200),
    zIndex: 100,
  };

  return (
    <div ref={ref} style={style} className="w-[320px] bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl">
      {loading ? (
        <div className="p-3 text-xs text-neutral-500">Loading...</div>
      ) : card && !showCreate ? (
        /* Existing card view */
        <div className="p-3 space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-neutral-100">{card.jp_text}</span>
          </div>
          {card.reading && (
            <p className="text-[16px] text-neutral-400">{card.reading}</p>
          )}
          {card.translation && (
            <p className="text-[16px] text-neutral-200">{card.translation}</p>
          )}
          {card.meaning && (
            <p className="text-[16px] text-neutral-400">{card.meaning}</p>
          )}
          {card.note && (
            <p className="text-[14px] text-neutral-500 italic">{card.note}</p>
          )}

          {/* Level selector */}
          <p className="text-[14px] text-neutral-500">Learned level</p>
          <div className="flex gap-1 items-center">
            {LEVELS.map((lv) => {
              const currentLevel = getCardLevel(card.status);
              const isActive = lv === currentLevel;
              return (
                <button
                  key={lv}
                  onClick={() => handleLevelChange(lv)}
                  className={`flex-1 py-1 text-[12px] font-medium rounded transition-colors ${
                    isActive ? LEVEL_COLORS[lv] : "bg-neutral-900 text-neutral-600 hover:text-neutral-400"
                  }`}
                  title={LEVEL_LABELS[lv]}
                >
                  {LEVEL_ROMAN[lv]}
                </button>
              );
            })}
          </div>

          <div className="flex gap-1.5 pt-0.5">
            <button
              onClick={handleCopy}
              className="px-2 py-1 text-[16px] bg-neutral-700 hover:bg-neutral-600 rounded transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      ) : showCreate ? (
        /* Create card form */
        <div className="p-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-neutral-300">
              New card: <span className="text-blue-400">{token.surface}</span>
            </span>
          </div>
          <input
            value={reading}
            onChange={(e) => setReading(e.target.value)}
            placeholder="Reading"
            className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-neutral-300"
            autoFocus
          />
          <input
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
            placeholder="Translation"
            className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-neutral-300"
          />
          <input
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            placeholder="Meaning / explanation"
            className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-neutral-300"
            onKeyDown={(e) => e.key === "Enter" && (translation || meaning) && handleCreateCard()}
          />
          <div className="flex gap-1.5">
            <button
              onClick={handleCreateCard}
              disabled={saving || (!reading && !translation && !meaning)}
              className="px-2 py-1 text-[16px] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded transition-colors"
            >
              {saving ? "Saving..." : "Save Card"}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-2 py-1 text-[16px] bg-neutral-700 hover:bg-neutral-600 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* No card — show actions */
        <div className="p-3 space-y-4">
          <p className="text-sm font-medium text-neutral-100">{token.surface}</p>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="px-2 py-1 text-[14px] bg-neutral-700 hover:bg-neutral-600 rounded transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="px-2 py-1 text-[14px] bg-blue-600 hover:bg-blue-500 rounded transition-colors"
            >
              + Create Card
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
