export interface OcrResult {
  raw_text: string;
  normalized_text: string;
  confidence: number;
  error: string | null;
}

export interface CaptureResult {
  imagePath: string;
  ocrResult: OcrResult;
  preset: string;
}
