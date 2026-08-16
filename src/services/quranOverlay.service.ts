import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import os from "os";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "@ffprobe-installer/ffprobe";
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

ffmpeg.setFfmpegPath(ffmpegStatic as any);
ffmpeg.setFfprobePath(ffprobeStatic.path);

const bidi = bidiFactory();

export const shapeArabicText = (text: string): string => {
  if (!text) return "";
  const joinedText = reshaper.ArabicShaper.convertArabic(text);
  const embeddingLevels = bidi.getEmbeddingLevels(joinedText);
  const reordered = bidi.getReorderedString(joinedText, embeddingLevels);
  return reordered.split("").reverse().join("");
};

const splitTextIntoChunks = (text: string, maxWordsPerChunk = 7): string[] => {
  const words = text.trim().split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWordsPerChunk) {
    chunks.push(words.slice(i, i + maxWordsPerChunk).join(" "));
  }
  return chunks;
};

const formatSrtTime = (seconds: number): string => {
  const pad = (num: number, size = 2) => String(num).padStart(size, "0");
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${String(millis).padStart(3, "0")}`;
};

const generateInMemorySrt = (
  arabicText: string,
  translationText: string,
  totalDuration: number,
): string => {
  const arabicChunks = splitTextIntoChunks(arabicText, 6);
  const translationChunks = splitTextIntoChunks(translationText, 8);

  const totalSegments = Math.max(arabicChunks.length, translationChunks.length);
  const segmentDuration = totalDuration / totalSegments;

  let srtContent = "";

  for (let i = 0; i < totalSegments; i++) {
    const startTime = i * segmentDuration;
    const endTime = (i + 1) * segmentDuration;

    const rawArabic = arabicChunks[i] || arabicChunks[arabicChunks.length - 1];
    const shapedArabic = shapeArabicText(String(rawArabic));
    const translation =
      translationChunks[i] || translationChunks[translationChunks.length - 1];

    srtContent += `${i + 1}\n`;
    srtContent += `${formatSrtTime(startTime)} --> ${formatSrtTime(endTime)}\n`;
    srtContent += `${shapedArabic}\n${translation}\n\n`;
  }

  return srtContent;
};

export const getAudioDuration = (audioUrl: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioUrl, (err, metadata) => {
      if (err) {
        return reject(
          new Error(`Failed to probe audio duration: ${err.message}`),
        );
      }
      const duration = metadata.format?.duration;
      if (!duration || isNaN(duration)) {
        return reject(new Error("Unable to determine audio track duration."));
      }
      resolve(duration);
    });
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
  surahNumber,
  ayahNumber,
  arabicText,
  translationText,
  surahName,
  onProgress,
}: OverlayRenderParams): Promise<string> => {
  const duration = await getAudioDuration(audioUrl);
  const srtContent = generateInMemorySrt(arabicText, translationText, duration);

  const tempSrtPath = path.join(os.tmpdir(), `sub_${jobId}_${Date.now()}.srt`);
  const tempVideoPath = path.join(
    os.tmpdir(),
    `render_${jobId}_${Date.now()}.mp4`,
  );

  await fs.promises.writeFile(tempSrtPath, srtContent, "utf8");

  const escapedSrtPath = tempSrtPath.replace(/\\/g, "/").replace(/:/g, "\\:");

  const cleanupTempFiles = () => {
    fs.unlink(tempSrtPath, () => {});
    fs.unlink(tempVideoPath, () => {});
  };

  // Step 1: Render video locally using FFmpeg to temp file
  await new Promise<void>((resolve, reject) => {
    let isFinished = false;

    const watchdogTimeout = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        cleanupTempFiles();
        reject(new Error("Render operation timed out after 5 minutes"));
      }
    }, 300000);

    const command = ffmpeg()
      .input(videoUrl)
      .inputOptions(["-stream_loop", "-1"])
      .input(audioUrl)
      .complexFilter([
        `[0:v]setpts=N/FRAME_RATE/TB[bg]`,
        `[bg]subtitles='${escapedSrtPath}':force_style='Fontsize=28,PrimaryColour=&H00FFFFFF&,OutlineColour=&H80000000&,BorderStyle=1,Outline=2,Alignment=2,MarginV=60'[outv]`,
      ])
      .outputOptions([
        "-map",
        "[outv]",
        "-map",
        "1:a",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-threads",
        "2",
        "-crf",
        "28",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-pix_fmt",
        "yuv420p",
        "-shortest",
        "-max_muxing_queue_size",
        "1024",
      ])
      .output(tempVideoPath);

    let lastProgressTime = 0;

    if (onProgress) {
      command.on("progress", (progress) => {
        const now = Date.now();
        if (now - lastProgressTime > 1000) {
          lastProgressTime = now;
          let percent = 0;

          if (progress.percent && !isNaN(progress.percent)) {
            percent = Math.min(Math.round(progress.percent), 95);
          } else if (progress.timemark && duration > 0) {
            const parts = progress.timemark.split(":");
            if (parts.length === 3) {
              const hours = parseFloat(parts[0] ?? "0") || 0;
              const minutes = parseFloat(parts[1] ?? "0") || 0;
              const seconds = parseFloat(parts[2] ?? "0") || 0;

              const currentSecs = hours * 3600 + minutes * 60 + seconds;
              percent = Math.min(Math.round((currentSecs / duration) * 95), 95);
            }
          }

          if (percent > 0) {
            try {
              Promise.resolve(onProgress(percent)).catch((err) =>
                console.error("Progress callback non-fatal error:", err),
              );
            } catch (err) {
              console.error("Sync progress callback error:", err);
            }
          }
        }
      });
    }

    command.on("end", () => {
      clearTimeout(watchdogTimeout);
      console.log(`[FFmpeg]: Local render completed for job ${jobId}.`);
      resolve();
    });

    command.run();
  });

  // Step 2: Upload the pre-rendered video file to Cloudinary in chunks
  try {
    if (onProgress) {
      await Promise.resolve(onProgress(98));
    }

    const uploadResult = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_large(
        tempVideoPath,
        {
          resource_type: "video",
          folder: "quran_generated_videos",
          chunk_size: 6000000, // 6MB chunks to prevent HTTP 413 Payload Too Large
          overwrite: true,
          use_filename: true,
          unique_filename: false,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );
    });

    if (!uploadResult?.secure_url) {
      throw new Error("Cloudinary upload failed: missing secure_url");
    }

    return uploadResult.secure_url;
  } finally {
    cleanupTempFiles();
  }
};