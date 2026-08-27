import axios from "axios";
import { parseBuffer } from "music-metadata";

export interface ValidationParams {
  arabicText: string;
  translationText: string;
  audioUrl: string;
  maxArabicChars?: number; // e.g., 400 chars
  maxTranslationChars?: number; // e.g., 800 chars
  maxDurationSeconds?: number; // e.g., 120 seconds (2 mins)
}

/**
 * Utility to retrieve audio duration in seconds using pure JavaScript parsing.
 * Downloads the buffer via axios to guarantee complete binary headers are available.
 */
export const getAudioDuration = async (audioUrl: string): Promise<number> => {
  if (!audioUrl || typeof audioUrl !== "string") {
    throw new Error("Invalid audio URL provided.");
  }

  try {
    // 1. Fetch entire audio file as an ArrayBuffer
    const response = await axios.get<ArrayBuffer>(audioUrl, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const buffer = Buffer.from(response.data);
    const contentType =
      (response.headers["content-type"] as string) || "audio/mpeg";

    // 2. Parse metadata from the complete buffer
    const metadata = await parseBuffer(buffer, contentType);
    const duration = metadata.format?.duration;

    if (!duration || isNaN(duration)) {
      throw new Error("Audio track duration could not be extracted.");
    }

    return duration;
  } catch (err: any) {
    throw new Error(`Failed to probe audio duration: ${err.message}`);
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
  // Guard against missing/non-string text so .length below can't throw a raw TypeError
  const safeArabicText = typeof arabicText === "string" ? arabicText : "";
  const safeTranslationText =
    typeof translationText === "string" ? translationText : "";

  // 1. Character Length Checks
  if (safeArabicText.length > maxArabicChars) {
    throw new Error(
      `Arabic text is too long (${safeArabicText.length} chars). Maximum allowed is ${maxArabicChars} chars to prevent excessive video size.`,
    );
  }

  if (safeTranslationText.length > maxTranslationChars) {
    throw new Error(
      `Translation text is too long (${safeTranslationText.length} chars). Maximum allowed is ${maxTranslationChars} chars to prevent excessive video size.`,
    );
  }

  // 2. Audio Duration Check
  const duration = await getAudioDuration(audioUrl);
  if (duration > maxDurationSeconds) {
    throw new Error(
      `Audio recitation duration is too long (${Math.round(duration)}s). Maximum allowed length is ${maxDurationSeconds}s (100MB limit).`,
    );
  }

  return { valid: true, duration };
};
