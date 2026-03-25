import { useMemo, useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { tokenize, type Token } from "../../lib/tokenizer";

interface Props {
  text: string;
  onTokenSelect?: (token: Token) => void;
}

export default function TokenizedText({ text, onTokenSelect }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const tokens = useMemo(() => tokenize(text), [text]);

  if (!text) return null;

  async function handleClick(token: Token, i: number) {
    await writeText(token.surface);
    setCopiedIdx(i);
    setTimeout(() => setCopiedIdx(null), 800);
    onTokenSelect?.(token);
  }

  return (
    <div className="flex flex-wrap gap-0.5 leading-relaxed">
      {tokens.map((token, i) => {
        const isWhitespace = /^\s+$/.test(token.surface);
        if (isWhitespace) return <span key={i}>{token.surface}</span>;

        return (
          <span
            key={i}
            onClick={() => handleClick(token, i)}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className={`px-0.5 rounded cursor-pointer transition-colors text-sm ${
              copiedIdx === i
                ? "bg-green-600/40 text-green-200"
                : hovered === i
                  ? "bg-blue-600/40 text-blue-200"
                  : "hover:bg-neutral-700 text-neutral-200"
            }`}
            title="Click to copy"
          >
            {token.surface}
          </span>
        );
      })}
    </div>
  );
}
