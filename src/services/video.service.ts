import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import { renderQuranOverlay } from "./quranOverlay.service.ts";
dotenv.config();
const cloud_name = process.env.CLOUD_NAME;
const api_key = process.env.CLOUD_API_KEY;
const api_secret = process.env.CLOUD_API_SECRET;
if (!cloud_name || !api_key || !api_secret) {
  throw new Error("Missing Cloudinary err.");
}
cloudinary.config({
  cloud_name: cloud_name,
  api_key: api_key,
  api_secret: api_secret,
  secure: true,
});

export interface GenerateVideoParams {
  audioUrl: string;
  arabicText: string;
  translation: string;
  surahName: string;
  ayahNumber: number;
}

export const generateVideoFromAudio = async (
  params: GenerateVideoParams,
): Promise<string> => {
  const { audioUrl, surahName, ayahNumber, translation } = params;

  const cloudName = process.env.CLOUD_NAME;
  if (!cloudName) {
    throw new Error("CLOUD_NAME is missing in environment variables.");
  }

  const backgroundUrl = cloudinary.url("quran_template_bg", {
    resource_type: "video",
    format: "mp4",
    secure: true,
  });

  return renderQuranOverlay({
    jobId: `autopost-${Date.now()}`,
    videoUrl: backgroundUrl,
    audioUrl,
    surahNumber: undefined,
    ayahNumber,
    arabicText: params.arabicText,
    translationText: translation,
    surahName,
  });
};
