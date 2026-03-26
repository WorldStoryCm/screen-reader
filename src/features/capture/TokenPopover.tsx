import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Card, CreateCardInput } from "../../types/card";
import { getCardLevel, LEVELS, LEVEL_LABELS, LEVEL_COLORS, LEVEL_ROMAN } from "../../types/card";
import type { Token } from "../../lib/tokenizer";
import { Button } from "@/components/button";
import { Input } from "@/components/input";

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
    <div ref={ref} style={style} className="w-[320px] bg-popover border border-border rounded-lg shadow-xl">
      {loading ? (
        <div className="p-3 text-sm text-muted-foreground">Loading...</div>
      ) : card && !showCreate ? (
        /* Existing card view */
        <div className="p-3 space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-foreground">{card.jp_text}</span>
          </div>
          {card.reading && (
            <p className="text-xs text-muted-foreground">{card.reading}</p>
          )}
          {card.translation && (
            <p className="text-xs text-foreground">{card.translation}</p>
          )}
          {card.meaning && (
            <p className="text-xs text-muted-foreground">{card.meaning}</p>
          )}
          {card.note && (
            <p className="text-[11px] text-muted-foreground/70 italic">{card.note}</p>
          )}

          {/* Level selector */}
          <p className="text-[11px] text-muted-foreground">Learned level</p>
          <div className="flex gap-1 items-center">
            {LEVELS.map((lv) => {
              const currentLevel = getCardLevel(card.status);
              const isActive = lv === currentLevel;
              return (
                <Button
                  key={lv}
                  variant="secondary"
                  size="sm"
                  className={`flex-1 h-7 text-[11px] font-medium ${
                    isActive ? LEVEL_COLORS[lv] : "text-muted-foreground"
                  }`}
                  onClick={() => handleLevelChange(lv)}
                  title={LEVEL_LABELS[lv]}
                >
                  {LEVEL_ROMAN[lv]}
                </Button>
              );
            })}
          </div>

          <div className="flex gap-1.5 pt-0.5">
            <Button variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>
      ) : showCreate ? (
        /* Create card form */
        <div className="p-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-secondary-foreground">
              New card: <span className="text-primary">{token.surface}</span>
            </span>
          </div>
          <Input
            value={reading}
            onChange={(e) => setReading(e.target.value)}
            placeholder="Reading"
            autoFocus
          />
          <Input
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
            placeholder="Translation"
          />
          <Input
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            placeholder="Meaning / explanation"
            onKeyDown={(e) => e.key === "Enter" && (translation || meaning) && handleCreateCard()}
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              onClick={handleCreateCard}
              disabled={saving || (!reading && !translation && !meaning)}
            >
              {saving ? "Saving..." : "Save Card"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        /* No card — show actions */
        <div className="p-3 space-y-4">
          <p className="text-sm font-medium text-foreground">{token.surface}</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              + Create Card
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
