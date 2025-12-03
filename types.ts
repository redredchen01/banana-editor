export interface ImageFile {
  file: File;
  previewUrl: string; // The data URL for display
  base64Data: string; // The raw base64 string (no prefix) for API
  mimeType: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface GenerationResult {
  imageUrl: string | null;
  textResponse: string | null;
}
