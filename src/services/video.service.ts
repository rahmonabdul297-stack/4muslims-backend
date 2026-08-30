import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import { renderQuranOverlay } from "./quranOverlay.service.ts";
import { Video } from "../models/videotemp.ts";
import { GeneratedVideo } from "../models/generatevideo.ts";
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
  userId: string;
}

export interface GeneratedVideoResult {
  videoUrl: string;
  templateId: string;
  cloudinaryPublicId?: string;
}

export const generateVideoFromAudio = async (
  params: GenerateVideoParams,
): Promise<GeneratedVideoResult> => {
  const { audioUrl, surahName, ayahNumber, translation, userId } = params;

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

  if (templates.length === 0) {
    throw new Error(
      "No active video templates are available. Upload at least one active video template.",
    );
  }

  // Don't repeat a background this user's autopost already used in the past 7 days
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentlyUsedTemplateIds = await GeneratedVideo.distinct("templateId", {
    userId,
    templateId: { $ne: null },
    createdAt: { $gte: oneWeekAgo },
  });
  const recentlyUsedSet = new Set(recentlyUsedTemplateIds.map(String));

  const eligibleTemplates = templates.filter(
    (t) => !recentlyUsedSet.has(String(t._id)),
  );
  // If every template has been used this week (small library), fall back to the full pool
  const candidatePool =
    eligibleTemplates.length > 0 ? eligibleTemplates : templates;

  const template =
    candidatePool[Math.floor(Math.random() * candidatePool.length)];
  const backgroundUrl = template?.videoUrl;

  if (!backgroundUrl) {
    throw new Error(
      "No active video templates are available. Upload at least one active video template.",
    );
  }

  const renderResult = await renderQuranOverlay({
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
    videoUrl: renderResult.outputUrl,
    templateId: String(template._id),
    cloudinaryPublicId: renderResult.cloudinaryPublicId,
  };
};
