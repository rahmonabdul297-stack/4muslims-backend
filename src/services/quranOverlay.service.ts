import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import reshaper from "arabic-persian-reshaper";
import bidiFactory from "bidi-js";
import { v2 as cloudinary } from "cloudinary";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStaticPath from "ffmpeg-static";
import { parseFile } from "music-metadata";
import { downloadFileToPath } from "../utils/downloadFile.ts";
import { ensureJobTempDir } from "../utils/tempDir.ts";

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

export const shapeArabicText = (text: string): string => {
  if (!text) return "";
  const joinedText = reshaper.ArabicShaper.convertArabic(text);
  const embeddingLevels = bidi.getEmbeddingLevels(joinedText);
  const reordered = bidi.getReorderedString(joinedText, embeddingLevels);
  return reordered.split("").reverse().join("");
};

/**
 * Strip ASS override-tag delimiters from user text so recitation/translation
 * content can never inject subtitle filter syntax.
 */
const escapeAssText = (text: string): string => {
  return (text || "")
    .replace(/\\/g, "\\\\")
    .replace(/[{}]/g, "")
    .replace(/\r?\n/g, "\\N");
};

/** Escape a filesystem path for use inside the ffmpeg `subtitles=` filter argument. */
const escapeSubtitlesFilterPath = (filePath: string): string => {
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
};

const formatAssTime = (seconds: number): string => {
  const clamped = Math.max(0, seconds);
  const hours = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = Math.floor(clamped % 60);
  const centis = Math.floor((clamped % 1) * 100);
  return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
};

// Number of words revealed together per subtitle cue
const WORDS_PER_CUE = 5;

/**
 * Build an ASS subtitle track where the Arabic ayah and its translation are
 * revealed in groups of WORDS_PER_CUE words in sync with elapsed audio time,
 * stacked together (Arabic just above the translation) in the lower-middle of the frame.
 */
const generateAssContent = (
  arabicText: string,
  translationText: string,
  totalDurationSeconds: number,
): string => {
  const arabicWords = arabicText.trim().split(/\s+/).filter(Boolean);
  const translationWords = translationText.trim().split(/\s+/).filter(Boolean);

  const buildWordGroupEvents = (
    words: string[],
    styleName: string,
    shape: boolean,
  ): string => {
    if (words.length === 0) return "";
    const perWord = totalDurationSeconds / words.length;
    const events: string[] = [];

    for (let i = 0; i < words.length; i += WORDS_PER_CUE) {
      const group = words.slice(i, i + WORDS_PER_CUE);
      const start = formatAssTime(i * perWord);
      const end = formatAssTime(
        Math.min(i + WORDS_PER_CUE, words.length) * perWord,
      );
      const joined = group.join(" ");
      const text = escapeAssText(shape ? shapeArabicText(joined) : joined);
      events.push(`Dialogue: 0,${start},${end},${styleName},,0,0,0,,${text}`);
    }

    return events.join("\n");
  };

  const arabicEvents = buildWordGroupEvents(arabicWords, "Arabic", true);
  const translationEvents = buildWordGroupEvents(
    translationWords,
    "Translation",
    false,
  );

  return `[Script Info]
Title: Quran Overlay
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Arabic,Arial,60,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,1,1,2,60,60,280,1
Style: Translation,Arial,38,&H00E0E0E0,&H000000FF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,1,1,2,60,60,200,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${arabicEvents}
${translationEvents}
`;
};

const getAudioDurationFromFile = async (filePath: string): Promise<number> => {
  const metadata = await parseFile(filePath);
  const duration = metadata.format?.duration;
  if (!duration || isNaN(duration)) {
    throw new Error("Could not determine audio duration from downloaded file");
  }
  return duration;
};

interface RunFfmpegParams {
  videoPath: string;
  audioPath: string;
  assPath: string;
  outputPath: string;
  audioDurationSeconds: number;
  onProgress?: (progress: number) => void;
}

/**
 * Merge the (looped) template video, the recitation audio and the ASS subtitle
 * track into a single mp4 using local ffmpeg configured strictly to stay under 512MB RAM.
 */
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

    ffmpeg()
      .input(videoPath)
      .inputOptions(["-stream_loop", "-1"])
      .input(audioPath)
      .complexFilter([`[0:v]scale=1920:-2,subtitles='${escapedAssPath}'[vout]`])
      .outputOptions([
        "-map",
        "[vout]",
        "-map",
        "1:a:0",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast", // MEMORY FIX: Fastest encoding preset uses minimal memory buffer
        "-threads",
        "1", // MEMORY FIX: Force single thread to prevent CPU/RAM spiking on Render
        "-max_muxing_queue_size",
        "1024", // MEMORY FIX: Caps buffer queue in RAM
        "-crf",
        "26", // Slightly higher compression to save bandwidth and memory
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k", // 128k audio buffer is sufficient and saves memory
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

/**
 * Render Quran overlay using a local ffmpeg binary in job-scoped scratch space.
 * Inputs are downloaded to tmp/<jobId>, rendered, uploaded to Cloudinary, then
 * the scratch directory is deleted — nothing persists on local disk afterward.
 */
export const renderQuranOverlay = async ({
  jobId,
  videoUrl,
  audioUrl,
  arabicText,
  translationText,
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

    // Step 1: Pull the template video and recitation audio into scratch space
    await Promise.all([
      downloadFileToPath(videoUrl, videoPath),
      downloadFileToPath(audioUrl, audioPath),
    ]);

    if (onProgress) await Promise.resolve(onProgress(20));

    // Step 2: Determine audio duration from the downloaded file (no re-fetch)
    const audioDuration = await getAudioDurationFromFile(audioPath);

    if (onProgress) await Promise.resolve(onProgress(25));

    // Step 3: Write the ASS subtitle track (Arabic top, translation bottom)
    const assContent = generateAssContent(
      arabicText,
      translationText,
      audioDuration,
    );
    await fs.promises.writeFile(assPath, assContent, "utf-8");

    if (onProgress) await Promise.resolve(onProgress(30));

    // Step 4: Render with local ffmpeg (loops video to cover full audio length)
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

    // Step 5: Upload the rendered file to Cloudinary for permanent storage
    const publicId = `quran_video_${safeJobId}`;
    console.log(`[quranOverlay] Uploading rendered video to Cloudinary...`);
    console.log(`  Public ID: ${publicId}`);

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

    console.log(`[quranOverlay] Rendered video for job ${safeJobId}`);
    console.log(`  Output URL: ${uploadResult.secure_url}`);
    console.log(`  Public ID: ${uploadResult.public_id}`);

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
    // Scratch space only — always clean up regardless of caller
    await fs.promises
      .rm(tempDir, { recursive: true, force: true })
      .catch(() => {});
  }
};
