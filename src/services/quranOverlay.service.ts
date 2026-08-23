import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import os from "os";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { parseWebStream } from "music-metadata";
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

ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || ffmpegInstaller.path);

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

const downloadFile = async (
  url: string,
  destination: string,
): Promise<void> => {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(
      `Failed to download render input. Status: ${response.status} (${url})`,
    );
  }

  await pipeline(
    Readable.fromWeb(response.body as any),
    fs.createWriteStream(destination),
  );
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
    // Arabic: Large (26px) & Bold (\b1)
    // Translation: Half-size (13px), Normal weight (\b0), Soft white color (\c&HE0E0E0&)
    srtContent += `{\\fs26\\b1}${shapedArabic}\n{\\fs13\\b0\\c&HE0E0E0&}${translation}{\\r}\n\n`;
  }

  return srtContent;
};

export const getAudioDuration = async (audioUrl: string): Promise<number> => {
  const response = await fetch(audioUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch audio file. Status: ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Audio stream response body is empty.");
  }

  const metadata = await parseWebStream(response.body, {
    mimeType: response.headers.get("content-type") || "audio/mpeg",
  });
  const duration = metadata.format.duration;

  if (!duration || isNaN(duration)) {
    throw new Error("Unable to determine audio track duration.");
  }

  return duration;
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

  const workDir = path.join(process.cwd(), "tmp", jobId);
  await fs.promises.mkdir(workDir, { recursive: true });

  const tempSrtPath = path.join(workDir, `sub_${Date.now()}.srt`);
  const tempVideoPath = path.join(workDir, `render_${Date.now()}.mp4`);
  const localVideoPath = path.join(workDir, "background.mp4");
  const localAudioPath = path.join(workDir, "audio.mp3");

  await fs.promises.writeFile(tempSrtPath, srtContent, "utf8");

  const escapedSrtPath = tempSrtPath.replace(/\\/g, "/").replace(/:/g, "\\:");

  const cleanupTempFiles = async () => {
    try {
      await fs.promises.rm(workDir, { recursive: true, force: true });
    } catch {
      // Ignore directory cleanup errors
    }
  };

  try {
    // Keep network I/O outside FFmpeg; remote inputs can crash static builds on Render.
    await downloadFile(videoUrl, localVideoPath);
    await downloadFile(audioUrl, localAudioPath);

    // Step 1: Render video locally using FFmpeg with hard file size limits
    await new Promise<void>((resolve, reject) => {
      let isFinished = false;

      const command = ffmpeg()
        .input(localVideoPath)
        .inputOptions(["-stream_loop", "-1"])
        .input(localAudioPath)
        .complexFilter([
          `[0:v]setpts=N/FRAME_RATE/TB[bg]`,
          // WrapStyle=2 allows clean responsive text wrapping across video widths
          // MarginL=50 & MarginR=50 prevent text from hitting side edges or clumping awkwardly
          `[bg]subtitles='${escapedSrtPath}':force_style='Fontsize=26,PrimaryColour=&H00FFFFFF&,OutlineColour=&H80000000&,BorderStyle=1,Outline=2,Alignment=2,MarginV=50,MarginL=50,MarginR=50,WrapStyle=2'[outv]`,
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
          "1",
          "-crf",
          "30", // Keeps file size significantly smaller
          "-maxrate",
          "3500k", // Caps peak video bitrate to 3.5 Mbps
          "-bufsize",
          "7000k",
          "-fs",
          "90M", // Forces FFmpeg to abort if output hits 90 MB
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

      const watchdogTimeout = setTimeout(() => {
        if (!isFinished) {
          isFinished = true;
          command.kill("SIGKILL");
          reject(new Error("Render operation timed out after 5 minutes"));
        }
      }, 300000);

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
                percent = Math.min(
                  Math.round((currentSecs / duration) * 95),
                  95,
                );
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

      command.on("error", (err) => {
        if (isFinished) return;
        isFinished = true;
        clearTimeout(watchdogTimeout);
        reject(new Error(`FFmpeg rendering failed: ${err.message}`));
      });

      command.on("stderr", (line) => {
        console.error(`[FFmpeg ${jobId}] ${line}`);
      });

      command.on("end", () => {
        if (isFinished) return;
        isFinished = true;
        clearTimeout(watchdogTimeout);
        console.log(`[FFmpeg]: Local render completed for job ${jobId}.`);
        resolve();
      });

      command.run();
    });

    // Step 2: Validate file size before uploading to Cloudinary
    const fileStats = await fs.promises.stat(tempVideoPath);
    const maxSizeBytes = 95 * 1024 * 1024; // 95 MB threshold

    if (fileStats.size > maxSizeBytes) {
      throw new Error(
        `Rendered video size (${(fileStats.size / (1024 * 1024)).toFixed(
          2,
        )} MB) exceeds Cloudinary's maximum allowed limit of 95 MB.`,
      );
    }

    // Step 3: Upload rendered file to Cloudinary in chunks
    if (onProgress) {
      await Promise.resolve(onProgress(98));
    }

    const uploadResult = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_large(
        tempVideoPath,
        {
          resource_type: "video",
          folder: "quran_generated_videos",
          chunk_size: 6000000, // 6MB chunks to prevent HTTP 413
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
    await cleanupTempFiles();
  }
};
