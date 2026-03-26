export interface CardSource {
  source_id: string;
  source_type: string;
  source_name: string;
  context_text: string | null;
  screen_name: string | null;
}

export interface Card {
  id: string;
  jp_text: string;
  reading: string;
  meaning: string;
  translation: string;
  note: string | null;
  status: string; // "1"-"5" level
  category: string | null;
  source_capture_id: string | null;
  source_text_fragment: string | null;
  created_at: string;
  updated_at: string;
  tags: string[];
  sources: CardSource[];
}

export interface CreateCardInput {
  jp_text: string;
  reading: string;
  meaning: string;
  translation: string | null;
  note: string | null;
  category: string | null;
  source_capture_id: string | null;
  source_text_fragment: string | null;
  tags: string[];
}

export const CATEGORIES = [
  "ui", "combat", "stat", "item", "trade", "quest",
  "dialogue", "navigation", "system", "other",
] as const;

export type Category = typeof CATEGORIES[number];

export type CardLevel = 1 | 2 | 3 | 4 | 5;
export const LEVELS: CardLevel[] = [1, 2, 3, 4, 5];

export const LEVEL_LABELS: Record<CardLevel, string> = {
  1: "I — New",
  2: "II — Seen",
  3: "III — Familiar",
  4: "IV — Mostly learned",
  5: "V — Learned",
};

export const LEVEL_COLORS: Record<CardLevel, string> = {
  1: "bg-neutral-700 text-neutral-300",
  2: "bg-amber-900/50 text-amber-300",
  3: "bg-yellow-900/50 text-yellow-300",
  4: "bg-emerald-900/50 text-emerald-300",
  5: "bg-green-800/50 text-green-300",
};

/** Color for token highlight in text based on card level */
export const LEVEL_TOKEN_COLORS: Record<CardLevel, string> = {
  1: "bg-neutral-700/40 text-neutral-300",
  2: "bg-amber-900/30 text-amber-200",
  3: "bg-yellow-900/30 text-yellow-200",
  4: "bg-emerald-900/30 text-emerald-200",
  5: "bg-green-900/30 text-green-200",
};

export const LEVEL_ROMAN: Record<CardLevel, string> = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
};

export function getCardLevel(status: string): CardLevel {
  const n = parseInt(status, 10);
  if (n >= 1 && n <= 5) return n as CardLevel;
  return 1;
}
