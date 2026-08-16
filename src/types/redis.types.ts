export interface VideoRenderJobData {
  mongoRenderId: string;
  userId: string;
  templateId: string;
  videoUrl: string;
  audioUrl: string;
  arabicText: string;
  translationText: string;
  surahNumber: number;
  ayahNumber: number;
  globalAyahNumber: number;
  surahName?: string;
  reciterId: string;

  // Add the planConfig property to the interface
  planConfig: {
    hasWatermark: boolean;
    preset: "ultrafast" | "faster" | "medium";
    crf: string;
    resolutionScale?: string;
    audioBitrate: string;
    maxDurationSeconds: number;
  };
}