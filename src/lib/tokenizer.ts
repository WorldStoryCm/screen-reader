// @ts-expect-error — tiny-segmenter has no types
import TinySegmenter from "tiny-segmenter";

export interface Token {
  surface: string;
  startIdx: number;
  endIdx: number;
}

const segmenter = new TinySegmenter();

// Katakana Unicode range: U+30A0–U+30FF (includes ー long vowel mark)
const KATAKANA_RE = /^[\u30A0-\u30FF]+$/;

/**
 * Merge consecutive katakana-only tokens into single tokens.
 * TinySegmenter often splits katakana words character-by-character.
 */
function mergeKatakana(tokens: Token[]): Token[] {
  const merged: Token[] = [];

  for (const token of tokens) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      KATAKANA_RE.test(prev.surface) &&
      KATAKANA_RE.test(token.surface) &&
      prev.endIdx === token.startIdx
    ) {
      // Merge into previous token
      prev.surface += token.surface;
      prev.endIdx = token.endIdx;
    } else {
      merged.push({ ...token });
    }
  }

  return merged;
}

export function tokenize(text: string): Token[] {
  const segments: string[] = segmenter.segment(text);
  const tokens: Token[] = [];
  let idx = 0;

  for (const surface of segments) {
    const pos = text.indexOf(surface, idx);
    if (pos !== -1) {
      tokens.push({
        surface,
        startIdx: pos,
        endIdx: pos + surface.length,
      });
      idx = pos + surface.length;
    }
  }

  return mergeKatakana(tokens);
}
