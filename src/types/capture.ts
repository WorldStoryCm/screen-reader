export interface Capture {
  id: string;
  created_at: string;
  image_path: string;
  ocr_text: string;
  normalized_text: string;
  ocr_engine: string;
  preprocess_preset: string;
  width: number;
  height: number;
  tags_json: string | null;
  note: string | null;
  status: string;
  confidence: number;
  tags: string[];
}

export interface SaveCaptureInput {
  image_path: string;
  ocr_text: string;
  normalized_text: string;
  preprocess_preset: string;
  confidence: number;
}

export interface Tag {
  id: string;
  name: string;
}

export const PRESETS = ["default_ui", "small_text", "dark_bg", "light_bg"] as const;
export type Preset = (typeof PRESETS)[number];
