export interface Token {
  surface: string;
  startIdx: number;
  endIdx: number;
}

const segmenter = new Intl.Segmenter("ja", { granularity: "word" });

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];

  for (const { segment, index, isWordLike } of segmenter.segment(text)) {
    if (isWordLike) {
      tokens.push({
        surface: segment,
        startIdx: index,
        endIdx: index + segment.length,
      });
    } else if (/\s/.test(segment)) {
      // Preserve whitespace tokens for layout
      tokens.push({
        surface: segment,
        startIdx: index,
        endIdx: index + segment.length,
      });
    }
  }

  return tokens;
}
