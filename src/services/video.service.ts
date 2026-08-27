import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import { renderQuranOverlay } from "./quranOverlay.service.ts";
import { Video } from "../models/videotemp.ts";
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

export interface GeneratedVideoResult {
  videoUrl: string;
  templateId: string;
}

export const generateVideoFromAudio = async (
  params: GenerateVideoParams,
): Promise<GeneratedVideoResult> => {
  const { audioUrl, surahName, ayahNumber, translation } = params;

  const cloudName = process.env.CLOUD_NAME;
  if (!cloudName) {
    throw new Error("CLOUD_NAME is missing in environment variables.");
  }

  const templates = await Video.find({ isActive: true })
    .select({
      _id: 1,
      videoUrl: 1,
    })
    .lean();
  const template = templates[Math.floor(Math.random() * templates.length)];
  const backgroundUrl = template?.videoUrl;

  if (!backgroundUrl) {
    throw new Error(
      "No active video templates are available. Upload at least one active video template.",
    );
  }

  const videoUrl = await renderQuranOverlay({
    jobId: `autopost-${Date.now()}`,
    videoUrl: backgroundUrl,
    audioUrl,
    surahNumber: undefined,
    ayahNumber,
    arabicText: params.arabicText,
    translationText: translation,
    surahName,
  });

  return {
    videoUrl,
    templateId: String(template._id),
  };
};
