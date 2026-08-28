import dotenv from "dotenv";
dotenv.config();

import reshaper from "arabic-persian-reshaper";
import bidiFactory from "bidi-js";
import { v2 as cloudinary } from "cloudinary";

const ensureCloudinaryConfig = () => {
  const cloudName = process.env.CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUD_API_KEY?.trim();
  const apiSecret = process.env.CLOUD_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary config missing: CLOUD_NAME, CLOUD_API_KEY, and CLOUD_API_SECRET must be set.",
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
    timeout: 300000, // 5 minutes timeout for Cloudinary operations
  });
};

ensureCloudinaryConfig();

const bidi = bidiFactory();

export const shapeArabicText = (text: string): string => {
  if (!text) return "";
  const joinedText = reshaper.ArabicShaper.convertArabic(text);
  const embeddingLevels = bidi.getEmbeddingLevels(joinedText);
  const reordered = bidi.getReorderedString(joinedText, embeddingLevels);
  return reordered.split("").reverse().join("");
};

/**
 * Upload video to Cloudinary and return the public ID
 */
const uploadVideoToCloudinary = async (
  videoUrl: string,
  jobId: string,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      videoUrl,
      {
        resource_type: "video",
        folder: "quran_generated_videos",
        public_id: `video_${jobId}`,
        overwrite: true,
        timeout: 60000,
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.public_id) {
          return reject(
            new Error("Cloudinary upload failed: missing public_id"),
          );
        }
        resolve(result.public_id);
      },
    );
  });
};

export interface OverlayRenderParams {
  jobId: string;
  videoUrl: string;
  audioUrl: string;
  surahNumber: number | undefined;
  ayahNumber: number | undefined;
  arabicText: string;
  translationText: string;
  surahName: string | undefined;
  onProgress?: (progress: number) => Promise<void> | void;
}

/**
 * Render Quran overlay using Cloudinary's video transformation API.
 * No local FFmpeg processing - everything is done online.
 */
export const renderQuranOverlay = async ({
  jobId,
  videoUrl,
  audioUrl,
  surahNumber,
  ayahNumber,
  arabicText,
  translationText,
  surahName,
  onProgress,
}: OverlayRenderParams): Promise<string> => {
  try {
    // Progress: uploading to Cloudinary
    if (onProgress) {
      await Promise.resolve(onProgress(10));
    }

    // Step 1: Upload video to Cloudinary (or use external URL directly)
    const videoPublicId = await uploadVideoToCloudinary(videoUrl, jobId);

    if (onProgress) {
      await Promise.resolve(onProgress(40));
    }

    // Step 2: Shape Arabic text for proper display
    const shapedArabic = shapeArabicText(arabicText);

    if (onProgress) {
      await Promise.resolve(onProgress(60));
    }

    // Step 3: Build Cloudinary transformation URL with text overlays
    // Using Cloudinary's text overlay syntax for both Arabic and translation text
    const transformationUrl = cloudinary.url(videoPublicId, {
      resource_type: "video",
      transformation: [
        {
          // Overlay 1: Arabic text (positioned at top-center)
          overlay: {
            font_family: "arial",
            font_size: 60,
            font_weight: "bold",
            text: shapedArabic,
            color: "white",
            background: "rgba:0,0,0,0.5",
            border: "2px_solid_white",
          },
          gravity: "north",
          y: 30,
          effect: "shadow",
        },
        {
          // Overlay 2: Translation text (positioned at bottom-center)
          overlay: {
            font_family: "arial",
            font_size: 40,
            text: translationText,
            color: "white",
            background: "rgba:0,0,0,0.5",
          },
          gravity: "south",
          y: 30,
        },
      ],
      fetch_format: "auto",
      quality: "auto",
    });

    if (onProgress) {
      await Promise.resolve(onProgress(95));
    }

    console.log(`[quranOverlay] Generated transformation URL for job ${jobId}`);

    if (onProgress) {
      await Promise.resolve(onProgress(100));
    }

    return transformationUrl;
  } catch (error) {
    throw new Error(
      `Quran overlay rendering failed: ${(error as Error).message}`,
    );
  }
};
