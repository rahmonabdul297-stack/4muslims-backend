export interface sendEmailType {
  subject: string;
  message: string;
  send_to: string;
}

export interface VideoTemplateTypes {
  title: string;
  description: string;
  category: string;
  isPremium: boolean;
  cloudinaryPublicId: string;
  videoUrl: string;
  thumbnailUrl: string;
  durationSeconds: number;
  resolution: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface GenerateVideoTypes {
  jobId?: string;
  userId: string; // ref: User, required, indexed
  templateId: string; // ref: Template, required
  surahNumber: number; // required, 1–114
  ayahNumber: number; // required
  reciterId: string; // required, maps to Islamic audio API reciter
  arabicText: string; // selected verse text from public API
  translationText: string; // selected translation text from public API
  audioUrl?: string;
  globalAyahNumber?: number;
  surahName?: string;
  status: string; // "pending" | "processing" | "completed" | "failed"
  progress?: number; // 0–100, optional fine-grained tracking
  outputUrl: string; // final Cloudinary MP4 url, populated on completion
  errorMessage?: string;
  outputDurationSeconds?: number;
  createdAt?: Date;
  completedAt?: Date;
}
