import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import reshaper from "arabic-persian-reshaper";
import bidiFactory from "bidi-js";
import { v2 as cloudinary } from "cloudinary";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStaticPath from "ffmpeg-static";
import { parseFile } from "music-metadata";
import { downloadFileToPath } from "../utils/downloadFile.ts";
import { ensureJobTempDir } from "../utils/tempDir.ts";

// libass needs an explicit fontsdir to find bundled fonts at render time
const FONTS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fonts",
);

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

ensureCloudinaryConfig();

if (ffmpegStaticPath) {
  ffmpeg.setFfmpegPath(ffmpegStaticPath);
} else {
  console.warn(
    "[quranOverlay] ffmpeg-static did not resolve a binary path; relying on system ffmpeg.",
  );
}

const bidi = bidiFactory();

// Uthmani-script tashkeel/Quranic annotation marks
const ARABIC_DIACRITICS_REGEX =
  /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u08FF]/g;

const stripArabicDiacritics = (text: string): string =>
  text.replace(ARABIC_DIACRITICS_REGEX, "");

export const shapeArabicText = (text: string): string => {
  if (!text) return "";
  const cleanedText = stripArabicDiacritics(text);
  const joinedText = reshaper.ArabicShaper.convertArabic(cleanedText);
  const embeddingLevels = bidi.getEmbeddingLevels(joinedText);
  const reordered = bidi.getReorderedString(joinedText, embeddingLevels);
  return reordered.split("").reverse().join("");
};

const escapeAssText = (text: string): string => {
  return (text || "")
    .replace(/\\/g, "\\\\")
    .replace(/[{}]/g, "")
    .replace(/\r?\n/g, "\\N");
};

/**
 * Safely escapes file paths for FFmpeg's filtergraph parser.
 * Converts Windows backslashes to forward slashes and escapes single quotes.
 */
const escapeSubtitlesFilterPath = (filePath: string): string => {
  let sanitized = filePath.replace(/\\/g, "/");
  sanitized = sanitized.replace(/^([A-Za-z]):/, "$1\\:");
  sanitized = sanitized.replace(/'/g, "\\'");
  return sanitized;
};

const formatAssTime = (seconds: number): string => {
  const clamped = Math.max(0, seconds);
  const hours = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = Math.floor(clamped % 60);
  const centis = Math.floor((clamped % 1) * 100);
  return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
};

// Optimal independent word-count thresholds for 9:16 vertical displays
const ARABIC_WORDS_PER_CUE = 3;
const TRANSLATION_WORDS_PER_CUE = 4;

const generateAssContent = (
  arabicText: string,
  translationText: string,
  totalDurationSeconds: number,
  surahName?: string,
  ayahNumber?: number,
): string => {
  const arabicWords = arabicText.trim().split(/\s+/).filter(Boolean);
  const translationWords = translationText.trim().split(/\s+/).filter(Boolean);

  const buildWordGroupEvents = (
    words: string[],
    styleName: string,
    shape: boolean,
    chunkSize: number,
  ): string => {
    if (words.length === 0) return "";
    const perWord = totalDurationSeconds / words.length;
    const events: string[] = [];

    for (let i = 0; i < words.length; i += chunkSize) {
      const group = words.slice(i, i + chunkSize);
      const start = formatAssTime(i * perWord);
      const end = formatAssTime(
        Math.min(i + chunkSize, words.length) * perWord,
      );
      const joined = group.join(" ");
      const text = escapeAssText(shape ? shapeArabicText(joined) : joined);
      events.push(`Dialogue: 0,${start},${end},${styleName},,0,0,0,,${text}`);
    }

    return events.join("\n");
  };

  const arabicEvents = buildWordGroupEvents(
    arabicWords,
    "Arabic",
    true,
    ARABIC_WORDS_PER_CUE,
  );
  const translationEvents = buildWordGroupEvents(
    translationWords,
    "Translation",
    false,
    TRANSLATION_WORDS_PER_CUE,
  );

  let headerEvent = "";
  if (surahName || ayahNumber) {
    const startTime = formatAssTime(0);
    const endTime = formatAssTime(totalDurationSeconds);

    const headerTitleParts: string[] = [];
    if (surahName) headerTitleParts.push(`Surah ${surahName}`);
    if (ayahNumber) headerTitleParts.push(`Ayah ${ayahNumber}`);

    const headerText = escapeAssText(headerTitleParts.join(" • "));
    headerEvent = `Dialogue: 0,${startTime},${endTime},Header,,0,0,0,,${headerText}\n`;
  }

  return `[Script Info]
Title: Quran Overlay
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Header,Arial,42,&H00FFFFFF,&H00000000,&H00000000,&HFF000000,1,0,0,0,100,100,2,0,1,2,1,8,40,40,200,1
Style: Arabic,Amiri,140,&H00FFFFFF,&H00000000,&H00000000,&HFF000000,1,0,0,0,100,100,0,0,1,3,2,5,60,60,620,1
Style: Translation,Arial,62,&H00FFFFFF,&H00000000,&H00000000,&HFF000000,0,0,0,0,100,100,0,0,1,2,1,5,80,80,980,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${headerEvent}${arabicEvents}
${translationEvents}
`;
};

const getAudioDurationFromFile = async (filePath: string): Promise<number> => {
  try {
    const metadata = await parseFile(filePath);
    const duration = metadata.format?.duration;
    if (duration && !isNaN(duration)) return duration;
  } catch (_err) {
    // Fallback to FFprobe
  }

  return new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err || !metadata.format?.duration) {
        return reject(
          new Error("Could not determine audio duration from downloaded file"),
        );
      }
      resolve(metadata.format.duration);
    });
  });
};

interface RunFfmpegParams {
  videoPath: string;
  audioPath: string;
  assPath: string;
  outputPath: string;
  audioDurationSeconds: number;
  onProgress?: (progress: number) => void;
}

const runFfmpegRender = ({
  videoPath,
  audioPath,
  assPath,
  outputPath,
  audioDurationSeconds,
  onProgress,
}: RunFfmpegParams): Promise<void> => {
  return new Promise((resolve, reject) => {
    const escapedAssPath = escapeSubtitlesFilterPath(assPath);
    const escapedFontsDir = escapeSubtitlesFilterPath(FONTS_DIR);

    // Added high-quality lanczos scaling algorithm
    const filterString = `[0:v]scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,subtitles='${escapedAssPath}':fontsdir='${escapedFontsDir}'[vout]`;

    ffmpeg()
      .input(videoPath)
      .inputOptions(["-stream_loop", "-1"])
      .input(audioPath)
      .complexFilter([filterString])
      .outputOptions([
        "-map",
        "[vout]",
        "-map",
        "1:a:0",
        "-c:v",
        "libx264",
        "-preset",
        "medium", // Changed from fast to medium for higher encoding efficiency
        "-crf",
        "16", // Lowered from 18 to 16 for near-lossless output quality
        "-maxrate",
        "8M", // Enforce high max bitrate for fast action/motion
        "-bufsize",
        "16M",
        "-threads",
        "0",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-y",
      ])
      .duration(audioDurationSeconds)
      .on("progress", (progress) => {
        if (onProgress && typeof progress.percent === "number") {
          const scaled = 35 + Math.min(50, (progress.percent / 100) * 50);
          onProgress(Math.round(scaled));
        }
      })
      .on("error", (err: Error, _stdout, stderr) => {
        console.error("[quranOverlay] FFmpeg error:", err.message);
        if (stderr) console.error("[quranOverlay] FFmpeg stderr:", stderr);
        reject(new Error(`FFmpeg rendering failed: ${err.message}`));
      })
      .on("end", () => resolve())
      .save(outputPath);
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

export const renderQuranOverlay = async ({
  jobId,
  videoUrl,
  audioUrl,
  arabicText,
  translationText,
  surahName,
  ayahNumber,
  onProgress,
}: OverlayRenderParams): Promise<{
  outputUrl: string;
  cloudinaryPublicId: string;
}> => {
  const tempDir = await ensureJobTempDir(jobId);
  const safeJobId = path.basename(tempDir);

  const videoPath = path.join(tempDir, "input_video.mp4");
  const audioPath = path.join(tempDir, "input_audio.mp3");
  const assPath = path.join(tempDir, "subtitles.ass");
  const outputPath = path.join(tempDir, "output.mp4");

  try {
    if (onProgress) await Promise.resolve(onProgress(5));

    await Promise.all([
      downloadFileToPath(videoUrl, videoPath),
      downloadFileToPath(audioUrl, audioPath),
    ]);

    if (onProgress) await Promise.resolve(onProgress(20));

    const audioDuration = await getAudioDurationFromFile(audioPath);

    if (onProgress) await Promise.resolve(onProgress(25));

    const assContent = generateAssContent(
      arabicText,
      translationText,
      audioDuration,
      surahName,
      ayahNumber,
    );
    await fs.promises.writeFile(assPath, assContent, "utf-8");

    if (onProgress) await Promise.resolve(onProgress(30));

    console.log(
      `[quranOverlay] Rendering job ${safeJobId} with memory-optimized ffmpeg`,
    );
    await runFfmpegRender({
      videoPath,
      audioPath,
      assPath,
      outputPath,
      audioDurationSeconds: audioDuration,
      onProgress: (p) => {
        if (onProgress) Promise.resolve(onProgress(p)).catch(() => {});
      },
    });

    if (onProgress) await Promise.resolve(onProgress(85));

    const publicId = `quran_video_${safeJobId}`;
    console.log(`[quranOverlay] Uploading rendered video to Cloudinary...`);

    const uploadResult = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_large(
        outputPath,
        {
          resource_type: "video",
          public_id: publicId,
          folder: "quran_generated_videos",
          overwrite: true,
          chunk_size: 6000000,
          timeout: 600000,
          eager: [],
        },
        (error, result) => {
          if (error) {
            return reject(
              new Error(`Cloudinary video upload failed: ${error.message}`),
            );
          }
          if (!result?.secure_url) {
            return reject(
              new Error("Cloudinary video upload missing secure_url"),
            );
          }
          resolve(result);
        },
      );
    });

    if (onProgress) await Promise.resolve(onProgress(100));

    return {
      outputUrl: uploadResult.secure_url,
      cloudinaryPublicId: uploadResult.public_id,
    };
  } catch (error) {
    console.error(
      `[quranOverlay] Rendering failed for job ${safeJobId}:`,
      error,
    );
    throw new Error(
      `Quran overlay rendering failed: ${(error as Error).message}`,
    );
  } finally {
    await fs.promises
      .rm(tempDir, { recursive: true, force: true })
      .catch(() => {});
  }
};
