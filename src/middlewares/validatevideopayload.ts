import fs from "fs";
import path from "path";
import os from "os";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";

export interface ValidationParams {
  arabicText: string;
  translationText: string;
  audioUrl: string;
  maxArabicChars?: number; // e.g., 400 chars
  maxTranslationChars?: number; // e.g., 800 chars
  maxDurationSeconds?: number; // e.g., 120 seconds (2 mins)
}

/**
 * Utility to retrieve audio duration in seconds using ffprobe safely
 */
export const getAudioDuration = async (audioUrl: string): Promise<number> => {
  // If it's already a local file path, probe directly
  if (!audioUrl.startsWith("http://") && !audioUrl.startsWith("https://")) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioUrl, (err, metadata) => {
        if (err) {
          return reject(
            new Error(`Failed to probe audio duration: ${err.message}`)
          );
        }
        const duration = metadata.format.duration;
        if (!duration || isNaN(duration)) {
          return reject(
            new Error("Unable to determine audio track duration.")
          );
        }
        resolve(duration);
      });
    });
  }

  // Generate a unique temporary local file path in /tmp
  const tempAudioPath = path.join(
    os.tmpdir(),
    `audio_probe_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`
  );

  try {
    // 1. Download the remote audio stream to local disk
    const response = await axios({
      url: audioUrl,
      method: "GET",
      responseType: "stream",
    });

    const writer = fs.createWriteStream(tempAudioPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    // 2. Probe the safe local file
    const duration = await new Promise<number>((resolve, reject) => {
      ffmpeg.ffprobe(tempAudioPath, (err, metadata) => {
        if (err) {
          return reject(
            new Error(`Failed to probe audio duration: ${err.message}`)
          );
        }
        const dur = metadata.format.duration;
        if (!dur || isNaN(dur)) {
          return reject(
            new Error("Unable to determine audio track duration.")
          );
        }
        resolve(dur);
      });
    });

    return duration;
  } catch (error) {
    throw new Error(
      `Failed to probe audio duration: ${(error as Error).message}`
    );
  } finally {
    // 3. Always clean up the temporary file
    if (fs.existsSync(tempAudioPath)) {
      await fs.promises.unlink(tempAudioPath).catch(() => {});
    }
  }
};

/**
 * Validates text length and audio runtime before spawning FFmpeg
 */
export const validateRenderPayload = async ({
  arabicText,
  translationText,
  audioUrl,
  maxArabicChars = 1000,
  maxTranslationChars = 750,
  maxDurationSeconds = 120, // 2 minutes max length
}: ValidationParams): Promise<{ valid: true; duration: number }> => {
  // 1. Character Length Checks
  if (arabicText.length > maxArabicChars) {
    throw new Error(
      `Arabic text is too long (${arabicText.length} chars). Maximum allowed is ${maxArabicChars} chars to prevent excessive video size.`
    );
  }

  if (translationText.length > maxTranslationChars) {
    throw new Error(
      `Translation text is too long (${translationText.length} chars). Maximum allowed is ${maxTranslationChars} chars to prevent excessive video size.`
    );
  }

  // 2. Audio Duration Check
  const duration = await getAudioDuration(audioUrl);
  if (duration > maxDurationSeconds) {
    throw new Error(
      `Audio recitation duration is too long (${Math.round(
        duration
      )}s). Maximum allowed length is ${maxDurationSeconds}s (100MB limit).`
    );
  }

  return { valid: true, duration };
};