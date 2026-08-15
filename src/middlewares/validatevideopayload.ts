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
 * Utility to retrieve audio duration in seconds using ffprobe
 */
export const getAudioDuration = (audioUrl: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioUrl, (err, metadata) => {
      if (err) {
        return reject(
          new Error(`Failed to probe audio duration: ${err.message}`),
        );
      }
      const duration = metadata.format.duration;
      if (!duration || isNaN(duration)) {
        return reject(new Error("Unable to determine audio track duration."));
      }
      resolve(duration);
    });
  });
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
      `Arabic text is too long (${arabicText.length} chars). Maximum allowed is ${maxArabicChars} chars to prevent excessive video size.`,
    );
  }

  if (translationText.length > maxTranslationChars) {
    throw new Error(
      `Translation text is too long (${translationText.length} chars). Maximum allowed is ${maxTranslationChars} chars to prevent excessive video size.`,
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
