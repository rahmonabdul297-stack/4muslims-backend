import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import reshaper from "arabic-persian-reshaper";
import bidiFactory from "bidi-js";

ffmpeg.setFfmpegPath(ffmpegStatic as any);

const bidi = bidiFactory();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TMP_ROOT = path.resolve("tmp");
const ensureTempDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

export const shapeArabicText = (text: string): string => {
  if (!text) return "";
  const joinedText = reshaper.ArabicShaper.convertArabic(text);
  const embeddingLevels = bidi.getEmbeddingLevels(joinedText);
  return bidi.getReorderedString(joinedText, embeddingLevels);
};

const chunkString = (value: string, chunkSize: number) => {
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += chunkSize) {
    chunks.push(value.slice(i, i + chunkSize));
  }
  return chunks;
};

const wrapText = (text: string, maxChars = 36): string => {
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

  return lines.join("\\n");
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

// Format font path safely for FFmpeg drawtext on Windows/Linux
const formatFontPath = (fontPath: string) => {
  return fontPath.replace(/\\/g, "/").replace(/:/g, "\\:");
};

const downloadFile = async (url: string, outputPath: string) => {
  try {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        Accept: "*/*",
      },
    });
    await fs.promises.writeFile(outputPath, Buffer.from(response.data));
  } catch (error) {
    const axiosError = error as any;
    const status = axiosError?.response?.status;
    const statusText = axiosError?.response?.statusText;
    const message = axiosError?.message || "Unknown download error";
    throw new Error(
      `Failed to download ${url}: ${status || "no status"} ${statusText || message}`,
    );
  }
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

export const renderQuranOverlay = async ({
  jobId,
  videoUrl,
  audioUrl,
  surahNumber,
  ayahNumber,
  arabicText,
  translationText,
  onProgress,
}: OverlayRenderParams): Promise<string> => {
  const jobDir = path.join(TMP_ROOT, String(jobId));
  ensureTempDir(jobDir);

  const videoPath = path.join(jobDir, "template.mp4");
  const audioPath = path.join(jobDir, "audio.mp3");
  const outputPath = path.join(jobDir, "output.mp4");

  const rawFontPath = path.join(__dirname, "../fonts/Amiri-Regular.ttf");
  if (!fs.existsSync(rawFontPath)) {
    throw new Error(`Arabic font file not found at ${rawFontPath}`);
  }

  const safeFontPath = formatFontPath(rawFontPath);

  await Promise.all([
    downloadFile(videoUrl, videoPath),
    downloadFile(audioUrl, audioPath),
  ]);

  // Wrap and shape Arabic text
  const wrappedArabic = wrapText(arabicText, 35);
  const shapedArabic = shapeArabicText(wrappedArabic);
  const escapedArabicText = escapeFfmpegText(shapedArabic);

  // Wrap and escape Translation text
  const wrappedTranslation = wrapText(translationText, 45);
  const escapedTranslationText = escapeFfmpegText(wrappedTranslation);

  // Filter graph using setpts to fix timestamp reset during video playback
  const filterGraph = [
    `[0:v]setpts=N/FRAME_RATE/TB[bg]`,
    `[bg]drawtext=fontfile='${safeFontPath}':text='${escapedArabicText}':fontcolor=white:fontsize=48:line_spacing=14:x=(w-tw)/2:y=(h-th)/2.5:fix_bounds=1[v1]`,
    `[v1]drawtext=fontfile='${safeFontPath}':text='${escapedTranslationText}':fontcolor=white:fontsize=28:line_spacing=10:x=(w-tw)/2:y=(h-th)/1.6:fix_bounds=1`,
  ].join(";");

  return new Promise<string>((resolve, reject) => {
    let lastProgress = 0;

    const command = ffmpeg()
      .input(videoPath)
      .inputOptions(["-stream_loop", "-1"])
      .input(audioPath)
      .complexFilter(filterGraph)
      .outputOptions([
        "-map",
        "[v1]",
        "-map",
        "1:a",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-pix_fmt",
        "yuv420p",
        "-shortest",
        "-movflags",
        "+faststart",
        "-y",
      ])
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err));

    command.run();
  });
};
