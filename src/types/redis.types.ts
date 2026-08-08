export interface VideoRenderJobData {
  mongoRenderId: string; // Ref to MongoDB document _id
  userId: string;
  templateId: string;
  videoUrl: string;
  audioUrl: string;
  arabicText: string;
  translationText: string;
  surahNumber: number;
  ayahNumber: number;
  surahName?: string;
  reciterId: string;
}
