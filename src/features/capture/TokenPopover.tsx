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

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

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

  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.min(Math.max(4, anchorRect.left - 140), window.innerWidth - 320),
    top: Math.min(anchorRect.bottom + 6, window.innerHeight - 200),
    zIndex: 100,
  };

  return (
    <div ref={ref} style={style} className="w-[320px] bg-popover border border-border rounded-xl shadow-2xl overflow-hidden">
      {loading ? (
        <div className="p-4 text-sm text-muted-foreground">Looking up\u2026</div>
      ) : card && !showCreate ? (
        <div className="p-4 space-y-3">
          <span className="text-xl font-semibold text-foreground">{card.jp_text}</span>
          {card.reading && (
            <p className="text-sm text-muted-foreground">{card.reading}</p>
          )}
          {card.translation && (
            <p className="text-base text-foreground">{card.translation}</p>
          )}
          {card.meaning && (
            <p className="text-sm text-muted-foreground leading-relaxed">{card.meaning}</p>
          )}
          {card.note && (
            <p className="text-sm text-muted-foreground/60 italic">{card.note}</p>
          )}

          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground/60">Level</p>
            <div className="flex gap-1 items-center">
              {LEVELS.map((lv) => {
                const currentLevel = getCardLevel(card.status);
                const isActive = lv === currentLevel;
                return (
                  <Button
                    key={lv}
                    variant="ghost"
                    size="sm"
                    className={`flex-1 h-8 text-sm font-medium ${
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
          </div>

          <div className="flex gap-1.5 pt-1">
            <Button variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>
      ) : showCreate ? (
        <div className="p-4 space-y-2.5">
          <div>
            <span className="text-sm text-muted-foreground">New card</span>
            <span className="ml-2 text-xl font-semibold text-primary">{token.surface}</span>
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
          <div className="flex gap-1.5 pt-1">
            <Button
              size="sm"
              onClick={handleCreateCard}
              disabled={saving || (!reading && !translation && !meaning)}
            >
              {saving ? "Saving\u2026" : "Create card"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          <p className="text-xl font-semibold text-foreground">{token.surface}</p>
          <p className="text-sm text-muted-foreground">No card found for this word</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              Create card
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
