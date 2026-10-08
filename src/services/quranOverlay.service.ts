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

export const shapeArabicText = (text: string): string => {
  if (!text) return "";
  const joinedText = reshaper.ArabicShaper.convertArabic(text);
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

export interface AyahContent {
  ayahNumber: number;
  arabicText: string;
  translation: string;
  audioUrl: string;
}

/**
 * Generates ASS subtitles mapped precisely to each individual ayah's audio duration block.
 */
const generateMultiAyahAssContent = (
  ayahs: AyahContent[],
  ayahDurations: number[],
  totalDurationSeconds: number,
  surahName?: string,
): string => {
  let arabicEvents = "";
  let currentTime = 0;

  if (!Number.isFinite(totalDurationSeconds) || totalDurationSeconds <= 0) {
    throw new Error("Audio duration must be a positive finite number.");
  }

  const durations = ayahs.map((_, index) => {
    const duration = ayahDurations[index];
    return typeof duration === "number" &&
      Number.isFinite(duration) &&
      duration > 0
      ? duration
      : 3;
  });
  const measuredDuration = durations.reduce(
    (total, duration) => total + duration,
    0,
  );
  const durationScale = totalDurationSeconds / measuredDuration;

  ayahs.forEach((ayah, index) => {
    const duration = durations[index]! * durationScale;
    const startTime = currentTime;
    const endTime = currentTime + duration;
    currentTime = endTime;

    const arabicText = escapeAssText(shapeArabicText(ayah.arabicText.trim()));
    if (arabicText) {
      arabicEvents += `Dialogue: 0,${formatAssTime(startTime)},${formatAssTime(endTime)},Arabic,,0,0,0,,${arabicText}\n`;
    }
  });

  let headerEvent = "";
  const firstAyah = ayahs.at(0);
  const lastAyah = ayahs.at(-1);
  if (surahName && firstAyah && lastAyah) {
    const startRange = firstAyah.ayahNumber;
    const endRange = lastAyah.ayahNumber;
    const rangeLabel =
      startRange === endRange
        ? `Surah ${surahName} • Ayah ${startRange}`
        : `Surah ${surahName} • Verses ${startRange}-${endRange}`;

    headerEvent = `Dialogue: 0,${formatAssTime(0)},${formatAssTime(totalDurationSeconds)},Header,,0,0,0,,${escapeAssText(rangeLabel)}\n`;
  }

  return `[Script Info]
Title: Quran Overlay Multi-Ayah
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Header,Amiri,52,&H00FFFFFF,&H00000000,&H00000000,&HFF000000,0,0,0,0,100,100,2,0,1,2,1,8,40,40,600,1
Style: Arabic,Amiri,140,&H00FFFFFF,&H00000000,&H00000000,&HFF000000,0,0,0,0,100,100,0,0,1,2,1,2,60,60,500,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${headerEvent}${arabicEvents}
`;
};

const getAudioDurationFromFile = async (filePath: string): Promise<number> => {
  try {
    const metadata = await parseFile(filePath);
    const duration = metadata.format?.duration;
    if (
      typeof duration === "number" &&
      Number.isFinite(duration) &&
      duration > 0
    ) {
      return duration;
    }
  } catch (_err) {
    // Fallback to FFprobe
  }

  return new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      const duration = metadata.format?.duration;
      if (
        err ||
        typeof duration !== "number" ||
        !Number.isFinite(duration) ||
        duration <= 0
      ) {
        return reject(
          new Error("Could not determine audio duration from downloaded file"),
        );
      }
      resolve(duration);
    });
  });
};

const concatAudioFiles = (
  inputPaths: string[],
  outputPath: string,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const command = ffmpeg();
    inputPaths.forEach((p) => command.input(p));

    const filterString =
      inputPaths.map((_, i) => `[${i}:a]`).join("") +
      `concat=n=${inputPaths.length}:v=0:a=1[outa]`;

    command
      .complexFilter([filterString])
      .outputOptions(["-map", "[outa]", "-c:a", "aac", "-b:a", "192k"])
      .on("error", (err) =>
        reject(new Error(`Audio concatenation failed: ${err.message}`)),
      )
      .on("end", () => resolve())
      .save(outputPath);
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
        "medium",
        "-crf",
        "16",
        "-maxrate",
        "8M",
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
  ayahs?: AyahContent[];
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
  ayahs,
  onProgress,
}: OverlayRenderParams): Promise<{
  outputUrl: string;
  cloudinaryPublicId: string;
}> => {
  const tempDir = await ensureJobTempDir(jobId);
  const safeJobId = path.basename(tempDir);

  const videoPath = path.join(tempDir, "input_video.mp4");
  const mergedAudioPath = path.join(tempDir, "merged_audio.m4a");
  const assPath = path.join(tempDir, "subtitles.ass");
  const outputPath = path.join(tempDir, "output.mp4");

  try {
    if (onProgress) await Promise.resolve(onProgress(5));

    await downloadFileToPath(videoUrl, videoPath);

    let finalAudioPath = mergedAudioPath;
    let ayahDurations: number[] = [];

    // Download and concatenate individual ayah audios if multiple ayahs are present
    if (ayahs && ayahs.length > 0) {
      const audioTempPaths: string[] = [];
      for (let i = 0; i < ayahs.length; i++) {
        const individualAudioPath = path.join(tempDir, `ayah_${i}.mp3`);
        await downloadFileToPath(ayahs[i]!.audioUrl, individualAudioPath);
        audioTempPaths.push(individualAudioPath);
      }

      await concatAudioFiles(audioTempPaths, mergedAudioPath);

      for (const p of audioTempPaths) {
        const dur = await getAudioDurationFromFile(p);
        ayahDurations.push(dur);
      }
    } else {
      finalAudioPath = path.join(tempDir, "input_audio.mp3");
      await downloadFileToPath(audioUrl, finalAudioPath);
      ayahDurations.push(await getAudioDurationFromFile(finalAudioPath));
    }

    if (onProgress) await Promise.resolve(onProgress(20));

    const totalDuration = await getAudioDurationFromFile(finalAudioPath);

    if (onProgress) await Promise.resolve(onProgress(25));

    const effectiveAyahs =
      ayahs && ayahs.length > 0
        ? ayahs
        : [
            {
              ayahNumber: ayahNumber || 1,
              arabicText,
              translation: translationText,
              audioUrl,
            },
          ];

    const assContent = generateMultiAyahAssContent(
      effectiveAyahs,
      ayahDurations,
      totalDuration,
      surahName,
    );
    await fs.promises.writeFile(assPath, assContent, "utf-8");

    if (onProgress) await Promise.resolve(onProgress(30));

    console.log(
      `[quranOverlay] Rendering job ${safeJobId} with multi-ayah sequence audio`,
    );
    await runFfmpegRender({
      videoPath,
      audioPath: finalAudioPath,
      assPath,
      outputPath,
      audioDurationSeconds: totalDuration,
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
