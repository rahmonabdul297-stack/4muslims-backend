import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PassThrough } from "stream";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import reshaper from "arabic-persian-reshaper";
import bidiFactory from "bidi-js";
import { v2 as cloudinary } from "cloudinary";

const cloudName = process.env.CLOUD_NAME;
const apiKey = process.env.CLOUD_API_KEY;
const apiSecret = process.env.CLOUD_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error(
    "Cloudinary configuration is missing. Check CLOUD_NAME, CLOUD_API_KEY, and CLOUD_API_SECRET.",
  );
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

ffmpeg.setFfmpegPath(ffmpegStatic as any);

const bidi = bidiFactory();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Reshapes Arabic letters and handles Right-To-Left ordering correctly for FFmpeg drawtext
 */
export const shapeArabicText = (text: string): string => {
  if (!text) return "";
  // 1. Connect Arabic letters (initial, medial, final forms)
  const joinedText = reshaper.ArabicShaper.convertArabic(text);

  // 2. Process BiDi embedding
  const embeddingLevels = bidi.getEmbeddingLevels(joinedText);
  const reordered = bidi.getReorderedString(joinedText, embeddingLevels);

  // 3. Reverse string sequence so FFmpeg's LTR renderer displays it as RTL
  return reordered.split("").reverse().join("");
};

const chunkString = (value: string, chunkSize: number) => {
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += chunkSize) {
    chunks.push(value.slice(i, i + chunkSize));
  }
  return chunks;
};

const wrapText = (text: string, maxChars = 35): string => {
  if (!text) return "";
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
      continue;
    }

    const nextLength = currentLine.length + 1 + word.length;
    if (nextLength <= maxChars) {
      currentLine = `${currentLine} ${word}`;
    } else {
      lines.push(currentLine);
      if (word.length > maxChars) {
        lines.push(...chunkString(word, maxChars));
        currentLine = "";
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.join("\n");
};

const escapeFfmpegText = (value: string) => {
  if (!value) return "";
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/%/g, "%%")
    .replace(/\r?\n/g, "\\n");
};

const formatFontPath = (fontPath: string) => {
  return fontPath.replace(/\\/g, "/").replace(/:/g, "\\:");
};

const cleanUrl = (url: string): string => {
  if (!url) return "";
  const normalized = url.replace(/\\/g, "/");
  const match = normalized.match(/(https?:\/\/.+)/i);
  return match?.[1] ?? normalized;
};

export interface OverlayRenderParams {
  jobId: string;
  videoUrl: string;
  audioUrl: string;
  surahNumber: number;
  ayahNumber: number;
  arabicText: string;
  translationText: string;
  surahName?: string | undefined;
  onProgress?: (progress: number) => Promise<void> | void;
}

export const renderQuranOverlay = ({
  jobId,
  videoUrl: rawVideoUrl,
  audioUrl: rawAudioUrl,
  arabicText,
  translationText,
  onProgress,
}: OverlayRenderParams): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const videoUrl = cleanUrl(rawVideoUrl);
    const audioUrl = cleanUrl(rawAudioUrl);

    const rawFontPath = path.join(__dirname, "../fonts/Amiri-Regular.ttf");
    if (!fs.existsSync(rawFontPath)) {
      return reject(new Error(`Font file not found at ${rawFontPath}`));
    }
    const safeFontPath = formatFontPath(rawFontPath);

    // Shape & Reverse Arabic text for proper RTL display in FFmpeg
    const shapedArabic = shapeArabicText(arabicText);
    const escapedArabicText = escapeFfmpegText(shapedArabic);

    // Wrap & Escape Translation text
    const wrappedTranslation = wrapText(translationText, 32);
    const escapedTranslationText = escapeFfmpegText(wrappedTranslation);

    // FFmpeg Filter Graph
    const filterGraph = [
      `[0:v]setpts=N/FRAME_RATE/TB[bg]`,
      `[bg]drawtext=fontfile='${safeFontPath}':text='${escapedArabicText}':fontcolor=white:fontsize=50:line_spacing=18:bordercolor=black@0.7:borderw=3:x=(w-tw)/2:y=(h-th)/3:fix_bounds=1[v1]`,
      `[v1]drawtext=fontfile='${safeFontPath}':text='${escapedTranslationText}':fontcolor=white:fontsize=36:line_spacing=14:bordercolor=black@0.7:borderw=2:x=(w-tw)/2:y=(h-th)/1.45:fix_bounds=1[outv]`,
    ].join(";");

    const passthrough = new PassThrough();

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video",
        folder: "quran_generated_videos",
        format: "mp4",
        chunk_size: 6000000,
      },
      (error, result) => {
        if (error) {
          console.error("[Cloudinary Stream Error]:", error);
          return reject(error);
        }
        if (!result?.secure_url) {
          return reject(
            new Error("Cloudinary upload did not return a secure URL"),
          );
        }
        resolve(result.secure_url);
      },
    );

    passthrough.pipe(uploadStream);

    const command = ffmpeg()
      .input(videoUrl)
      .inputOptions(["-stream_loop", "-1"])
      .input(audioUrl)
      .complexFilter(filterGraph)
      .outputOptions([
        "-map",
        "[outv]",
        "-map",
        "1:a",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-pix_fmt",
        "yuv420p",
        "-shortest",
        "-f",
        "mp4",
        "-movflags",
        "frag_keyframe+empty_moov+default_base_moof",
      ]);

    if (onProgress) {
      command.on("progress", (progress) => {
        if (progress.percent) {
          const percent = Math.min(Math.round(progress.percent), 99);
          Promise.resolve(onProgress(percent)).catch((err) =>
            console.error("Progress callback error:", err),
          );
        }
      });
    }

    command.on("error", (err) => {
      console.error("[FFmpeg Stream Error]:", err);
      reject(err);
    });

    command.pipe(passthrough, { end: true });
  });
};
