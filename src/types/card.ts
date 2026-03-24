export interface Card {
  id: string;
  jp_text: string;
  reading: string;
  meaning: string;
  note: string | null;
  status: string;
  source_capture_id: string | null;
  source_text_fragment: string | null;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export interface CreateCardInput {
  jp_text: string;
  reading: string;
  meaning: string;
  note: string | null;
  source_capture_id: string | null;
  source_text_fragment: string | null;
  tags: string[];
}

export type CardStatus = "new" | "learning" | "known";
