import { useMemo, useState, useCallback } from "react";
import { tokenize, type Token } from "../../lib/tokenizer";
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
  const tokens = useMemo(() => tokenize(text), [text]);

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

  if (!text) return null;

  return (
    <div className="flex flex-wrap gap-0.5 leading-relaxed relative">
      {tokens.map((token, i) => {
        const isWhitespace = /^\s+$/.test(token.surface);
        if (isWhitespace) return <span key={i}>{token.surface}</span>;

        return (
          <span
            key={i}
            onClick={(e) => handleClick(token, i, e)}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className={`px-0.5 rounded cursor-pointer transition-colors text-sm ${
              popover?.index === i
                ? "bg-blue-600/40 text-blue-200"
                : hovered === i
                  ? "bg-blue-600/30 text-blue-200"
                  : "hover:bg-neutral-700 text-neutral-200"
            }`}
            title="Click for options"
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
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  );
}
