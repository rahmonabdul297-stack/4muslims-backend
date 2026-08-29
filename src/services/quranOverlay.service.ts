import dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import reshaper from "arabic-persian-reshaper";
import bidiFactory from "bidi-js";
import { v2 as cloudinary } from "cloudinary";
import Replicate from "replicate";
import { toDownloadUrl } from "../utils/cloudinaryHelper.ts";

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
    timeout: 300000,
  });
};

const getReplicateToken = () => {
  const apiToken = process.env.REPLICATE_API_TOKEN?.trim();
  if (!apiToken) {
    throw new Error(
      "Replicate API token missing: REPLICATE_API_TOKEN must be set.",
    );
  }
  return apiToken;
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
 * Upload video to Cloudinary and return URL (not public_id)
 */
const getVideoUrl = async (videoUrl: string): Promise<string> => {
  // If already a URL, return it; if local file, upload to Cloudinary
  if (videoUrl.startsWith("http")) {
    return videoUrl;
  }

  // Local file upload (not typical in our flow, but support it)
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      videoUrl,
      { resource_type: "video", folder: "quran_generated_videos" },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url) {
          return reject(new Error("Cloudinary upload failed"));
        }
        resolve(result.secure_url);
      },
    );
  });
};

/**
 * Generate SRT subtitle file content with full text displayed together
 * Arabic text displays at top (white), translation at bottom (light gray)
 * Both visible for entire audio duration
 */
const generateSrtContent = (
  arabicText: string,
  translationText: string,
  totalDurationSeconds: number,
): string => {
  // Format time for SRT (HH:MM:SS,mmm)
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
  };

  // Shape Arabic text for proper RTL display
  const shapedArabic = arabicText ? shapeArabicText(arabicText) : "";

  // Add small buffer to ensure subtitle covers entire audio
  const startTime = 0;
  const endTime = Math.ceil(totalDurationSeconds) + 1;

  // SRT format: index, timecode, text, blank line
  // Using ASS-style tags that FFmpeg subtitles filter will parse
  let srtContent = "";
  srtContent += "1\n"; // Index
  srtContent += `${formatTime(startTime)} --> ${formatTime(endTime)}\n`; // Timecode

  // Text with styling tags for FFmpeg subtitles filter
  // Format: {tag}text
  // White color for Arabic, light gray for translation
  srtContent += `{\\c&HFFFFFF&}{\\fs50}{\\b1}${shapedArabic}\\n\\n{\\c&HE0E0E0&}{\\fs32}${translationText}{\\r}\n\n`;

  return srtContent;
};

/**
 * Get audio duration from URL
 */
const getAudioDuration = async (audioUrl: string): Promise<number> => {
  try {
    const response = await axios.get(audioUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const buffer = Buffer.from(response.data);
    const { parseBuffer } = await import("music-metadata");
    const metadata = await parseBuffer(buffer, "audio/mpeg");
    const duration = metadata.format?.duration;

    if (!duration || isNaN(duration)) {
      throw new Error("Could not determine audio duration");
    }

    return duration;
  } catch (error) {
    throw new Error(
      `Failed to get audio duration: ${(error as Error).message}`,
    );
  }
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
 * Render Quran overlay using Replicate's FFmpeg model
 * Properly merges video + audio + animated text overlays as one complete video file
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
}: OverlayRenderParams): Promise<{
  outputUrl: string;
  cloudinaryPublicId: string;
}> => {
  const apiToken = getReplicateToken();
  const replicate = new Replicate({
    auth: apiToken,
  });

  try {
    if (onProgress) await Promise.resolve(onProgress(10));

    // Step 1: Get URLs and audio duration
    const finalVideoUrl = await getVideoUrl(videoUrl);
    const audioDuration = await getAudioDuration(audioUrl);

    if (onProgress) await Promise.resolve(onProgress(20));

    // Step 2: Generate SRT subtitle file with timed text overlays
    const srtContent = generateSrtContent(
      arabicText,
      translationText,
      audioDuration,
    );

    if (onProgress) await Promise.resolve(onProgress(30));

    // Step 3: Upload SRT to Cloudinary for access by FFmpeg
    const srtUrl = await new Promise<string>((resolve, reject) => {
      cloudinary.uploader.upload(
        `data:text/plain;base64,${Buffer.from(srtContent).toString("base64")}`,
        {
          resource_type: "raw",
          format: "srt",
          public_id: `subtitles_${jobId}`,
          folder: "quran_subtitles",
          overwrite: true,
        },
        (error, result) => {
          if (error) {
            return reject(new Error(`SRT upload failed: ${error.message}`));
          }
          if (!result) {
            return reject(
              new Error("SRT upload returned empty result from Cloudinary"),
            );
          }
          if (!result.secure_url) {
            return reject(
              new Error(
                `SRT upload missing secure_url: ${JSON.stringify(result)}`,
              ),
            );
          }
          resolve(result.secure_url);
        },
      );
    });

    if (onProgress) await Promise.resolve(onProgress(40));

    // Step 4: Call Replicate's FFmpeg model to render video with audio and subtitles
    console.log(`[quranOverlay] Calling Replicate FFmpeg for job ${jobId}`);
    console.log(`  Video: ${finalVideoUrl}`);
    console.log(`  Audio: ${audioUrl}`);
    console.log(`  Duration: ${audioDuration}s`);

    // Use Replicate's FFmpeg model to merge video + audio + subtitles
    // This takes 5-10 minutes depending on video length
    let output: any;
    try {
      // FFmpeg filter complex:
      // 1. Scale video to 1920x1080 (maintains aspect ratio, -2 ensures even pixels)
      // 2. Apply subtitles from SRT file with styling
      // 3. Output labeled streams for muxing
      // Audio is automatically included from the audio input
      const filterComplex =
        "[0:v]scale=1920:-2,subtitles=[subtitle]:force_style='FontName=Arial,FontSize=50,FontColor=&HFFFFFF&,BorderStyle=3,OutlineColor=&H000000&,Outline=2'[vout]";

      console.log(`[quranOverlay] FFmpeg filter: ${filterComplex}`);

      output = (await replicate.run("lucataco/ffmpeg:0e38e9e0", {
        input: {
          video: finalVideoUrl,
          audio: audioUrl,
          subtitle: srtUrl,
          filter_complex: filterComplex,
          output_format: "mp4",
          output_vcodec: "h264",
          output_acodec: "aac",
          output_bitrate: "5M",
          audio_bitrate: "192k", // Ensure audio is included with proper quality
        },
      })) as any;
    } catch (replicateError) {
      // Log detailed error for debugging
      console.error(`[quranOverlay] Replicate error for job ${jobId}:`, {
        message: (replicateError as Error).message,
        error: replicateError,
      });
      throw replicateError;
    }

    if (onProgress) await Promise.resolve(onProgress(70));

    // Step 5: Validate and process Replicate output
    let finalUrl: string;
    let publicId: string;

    if (typeof output === "string") {
      // Output is a URL string
      finalUrl = output;
      publicId = `quran_video_${jobId}`;
    } else if (Array.isArray(output) && output[0]) {
      // Output is an array with URL as first element
      finalUrl = output[0];
      publicId = `quran_video_${jobId}`;
    } else {
      console.error(
        `[quranOverlay] Unexpected Replicate output format:`,
        output,
      );
      throw new Error(
        `Unexpected output format from Replicate. Expected string or array, got: ${typeof output}`,
      );
    }

    // Validate that the URL is an actual video file, not a Cloudinary transformation
    if (
      !finalUrl.includes(".mp4") &&
      !finalUrl.includes(".webm") &&
      !finalUrl.includes(".mov")
    ) {
      console.error(
        `[quranOverlay] Output URL doesn't appear to be a video file:`,
        finalUrl,
      );
      console.error(`[quranOverlay] Replicate full output was:`, output);
      throw new Error(
        `Replicate output is not a video file. URL: ${finalUrl}. Check Replicate model output.`,
      );
    }

    console.log(
      `[quranOverlay] Replicate successfully rendered video for job ${jobId}`,
    );
    console.log(`  Rendered URL: ${finalUrl}`);
    console.log(
      `  URL is video file: ${finalUrl.includes(".mp4") || finalUrl.includes(".webm") || finalUrl.includes(".mov")}`,
    );

    if (onProgress) await Promise.resolve(onProgress(85));

    // Step 6: Upload output to Cloudinary for permanent storage
    console.log(`[quranOverlay] Uploading rendered video to Cloudinary...`);
    console.log(`  Public ID: ${publicId}`);
    console.log(`  Resource Type: video`);
    console.log(`  Folder: quran_generated_videos`);

    // Upload to Cloudinary for permanent storage
    const uploadResult = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload(
        finalUrl,
        {
          resource_type: "video",
          public_id: publicId,
          folder: "quran_generated_videos",
          overwrite: true,
          timeout: 600000, // 10 minutes for upload
          // Explicitly set eager transformations off to prevent auto-transformations
          eager: [],
        },
        (error, result) => {
          if (error) {
            console.error(`[quranOverlay] Cloudinary upload error:`, {
              error: error.message,
              public_id: publicId,
            });
            return reject(
              new Error(`Cloudinary video upload failed: ${error.message}`),
            );
          }
          if (!result) {
            return reject(
              new Error("Cloudinary returned empty result for video upload"),
            );
          }
          if (!result.secure_url) {
            return reject(
              new Error(
                `Cloudinary video upload missing secure_url: ${JSON.stringify(result)}`,
              ),
            );
          }
          if (!result.public_id) {
            return reject(
              new Error("Cloudinary video upload missing public_id"),
            );
          }
          resolve(result);
        },
      );
    });

    if (onProgress) await Promise.resolve(onProgress(95));

    console.log(`[quranOverlay] Rendered video for job ${jobId}`);
    console.log(`  Output URL: ${uploadResult.secure_url}`);
    console.log(`  Public ID: ${uploadResult.public_id}`);

    if (onProgress) await Promise.resolve(onProgress(100));

    // Convert to download URL to force browser download instead of playback
    const downloadUrl = toDownloadUrl(uploadResult.secure_url);

    return {
      outputUrl: downloadUrl,
      cloudinaryPublicId: uploadResult.public_id,
    };
  } catch (error) {
    console.error(`[quranOverlay] Rendering failed for job ${jobId}:`, error);
    throw new Error(
      `Quran overlay rendering failed: ${(error as Error).message}`,
    );
  }
};
