// @ts-expect-error — tiny-segmenter has no types
import TinySegmenter from "tiny-segmenter";

export interface Token {
  surface: string;
  startIdx: number;
  endIdx: number;
}

const segmenter = new TinySegmenter();

export function tokenize(text: string): Token[] {
  const segments: string[] = segmenter.segment(text);
  const tokens: Token[] = [];
  let idx = 0;

  for (const surface of segments) {
    // Find the actual position in the original text
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

  return tokens;
}
