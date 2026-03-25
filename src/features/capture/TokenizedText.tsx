import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { tokenize, type Token } from "../../lib/tokenizer";
import type { Card } from "../../types/card";
import { getCardLevel, LEVEL_TOKEN_COLORS, LEVEL_ROMAN } from "../../types/card";
import TokenPopover from "./TokenPopover";

interface Props {
  text: string;
  captureId?: string;
  onTokenSelect?: (token: Token) => void;
}

export default function TokenizedText({ text, captureId, onTokenSelect }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [popover, setPopover] = useState<{
    token: Token;
    index: number;
    rect: { left: number; top: number; bottom: number };
  } | null>(null);
  const [cardMap, setCardMap] = useState<Map<string, Card>>(new Map());

  const tokens = useMemo(() => tokenize(text), [text]);

  // Batch lookup which tokens have cards
  useEffect(() => {
    if (!tokens.length) return;
    const unique = [...new Set(tokens.map((t) => t.surface).filter((s) => !/^\s+$/.test(s)))];
    if (!unique.length) return;
    invoke<Card[]>("find_cards_by_texts", { texts: unique })
      .then((cards) => {
        const map = new Map<string, Card>();
        for (const card of cards) map.set(card.jp_text, card);
        setCardMap(map);
      })
      .catch(console.error);
  }, [tokens]);

  const handleClick = useCallback(
    (token: Token, i: number, e: React.MouseEvent) => {
      const el = e.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();
      setPopover({
        token,
        index: i,
        rect: { left: rect.left, top: rect.top, bottom: rect.bottom },
      });
      onTokenSelect?.(token);
    },
    [onTokenSelect]
  );

  // Refresh card map when popover closes (card may have been created/updated)
  const handlePopoverClose = useCallback(() => {
    setPopover(null);
    const unique = [...new Set(tokens.map((t) => t.surface).filter((s) => !/^\s+$/.test(s)))];
    if (!unique.length) return;
    invoke<Card[]>("find_cards_by_texts", { texts: unique })
      .then((cards) => {
        const map = new Map<string, Card>();
        for (const card of cards) map.set(card.jp_text, card);
        setCardMap(map);
      })
      .catch(console.error);
  }, [tokens]);

  if (!text) return null;

  return (
    <div className="flex flex-wrap gap-0.5 leading-relaxed relative">
      {tokens.map((token, i) => {
        const isWhitespace = /^\s+$/.test(token.surface);
        if (isWhitespace) return <span key={i}>{token.surface}</span>;

        const card = cardMap.get(token.surface);
        const level = card ? getCardLevel(card.status) : null;
        const levelColor = level ? LEVEL_TOKEN_COLORS[level] : "";

        return (
          <span
            key={i}
            onClick={(e) => handleClick(token, i, e)}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className={`px-0.5 rounded cursor-pointer transition-colors text-sm border-b ${
              popover?.index === i
                ? "bg-blue-600/40 text-blue-200 border-blue-400"
                : hovered === i
                  ? "bg-blue-600/30 text-blue-200 border-blue-400"
                  : level
                    ? `${levelColor} border-current`
                    : "hover:bg-neutral-700 text-neutral-200 border-transparent"
            }`}
            title={card ? `${LEVEL_ROMAN[level!]} — ${card.reading || card.meaning || card.jp_text}` : "Click for options"}
          >
            {token.surface}
          </span>
        );
      })}
      {popover && (
        <TokenPopover
          token={popover.token}
          anchorRect={popover.rect}
          captureId={captureId}
          onClose={handlePopoverClose}
        />
      )}
    </div>
  );
}
