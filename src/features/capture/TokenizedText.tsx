import { useMemo, useState } from "react";
import { tokenize, type Token } from "../../lib/tokenizer";

interface Props {
  text: string;
  onTokenSelect: (token: Token) => void;
}

export default function TokenizedText({ text, onTokenSelect }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const tokens = useMemo(() => tokenize(text), [text]);

  if (!text) return null;

  return (
    <div className="flex flex-wrap gap-0.5 leading-relaxed">
      {tokens.map((token, i) => {
        const isWhitespace = /^\s+$/.test(token.surface);
        if (isWhitespace) return <span key={i}>{token.surface}</span>;

        return (
          <span
            key={i}
            onClick={() => onTokenSelect(token)}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className={`px-0.5 rounded cursor-pointer transition-colors text-sm ${
              hovered === i
                ? "bg-blue-600/40 text-blue-200"
                : "hover:bg-neutral-700 text-neutral-200"
            }`}
          >
            {token.surface}
          </span>
        );
      })}
    </div>
  );
}
