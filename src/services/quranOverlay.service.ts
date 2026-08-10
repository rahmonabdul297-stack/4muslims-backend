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

/**
 * Connects cursive Arabic characters and reorders text for engines lacking CTL.
 */
export const shapeArabicText = (text: string): string => {
  if (!text) return "";
  const joinedText = reshaper.ArabicReshaper.convertArabic(text);
  const embeddingLevels = bidi.getEmbeddingLevels(joinedText);
  return bidi.getReorderedString(joinedText, embeddingLevels);
};

// Safe escaping for text strings in FFmpeg drawtext
const escapeFfmpegText = (value: string) => {
  if (!value) return "";
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "'\\\\''")
    .replace(/%/g, "%%");
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
      `Failed to download ${url}: ${status || "no status"} ${statusText || message}`
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
  surahName,
  onProgress,
}: OverlayRenderParams): Promise<string> => {
  const jobDir = path.join(TMP_ROOT, String(jobId));
  ensureTempDir(jobDir);

  const videoPath = path.join(jobDir, "template.mp4");
  const audioPath = path.join(jobDir, "audio.mp3");
  const outputPath = path.join(jobDir, "output.mp4");

  const rawFontPath = path.join(__dirname, "../fonts/Amiri-Regular.ttf");
  if (!fs.existsSync(rawFontPath)) {
    throw new Error(
      `Arabic font file not found at ${rawFontPath}. Please ensure Amiri-Regular.ttf exists in src/fonts/`
    );
  }

  const safeFontPath = formatFontPath(rawFontPath);

  await Promise.all([
    downloadFile(videoUrl, videoPath),
    downloadFile(audioUrl, audioPath),
  ]);

  // Pre-shape the Arabic text before escaping
  const reshapedArabic = shapeArabicText(arabicText);
  const escapedArabicText = escapeFfmpegText(reshapedArabic);
  const escapedTranslationText = escapeFfmpegText(translationText);

  console.log(`[renderQuranOverlay:${jobId}] Rendering overlay:`);
  console.log(` - Arabic string length: ${arabicText?.length || 0}`);
  console.log(` - Translation string length: ${translationText?.length || 0}`);
  console.log(` - Font path: ${safeFontPath}`);

  // Complex filter graph with shaped Arabic text and bounds safety
  const arabicFilter = `drawtext=fontfile='${safeFontPath}':text='${escapedArabicText}':fontcolor=white:fontsize=48:box=1:boxcolor=black@0.5:boxborderw=10:x=(w-tw)/2:y=(h-th)/2.5:fix_bounds=1`;
  const translationFilter = `drawtext=fontfile='${safeFontPath}':text='${escapedTranslationText}':fontcolor=white:fontsize=28:box=1:boxcolor=black@0.5:boxborderw=8:x=(w-tw)/2:y=(h-th)/1.6:fix_bounds=1`;

  const filterGraph = `${arabicFilter},${translationFilter}`;

  return new Promise<string>((resolve, reject) => {
    let lastProgress = 0;

    const command = ffmpeg()
      .input(videoPath)
      .inputOptions(["-stream_loop", "-1"])
      .input(audioPath)
      .complexFilter(filterGraph)
      .outputOptions([
        "-map",
        "0:v",
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
      .on("start", (cmd) => {
        console.log("Executing FFmpeg command:\n", cmd);
      })
      .on("stderr", (stderrLine) => {
        if (
          stderrLine.includes("drawtext") ||
          stderrLine.includes("Filter") ||
          stderrLine.includes("Error")
        ) {
          console.error("FFmpeg Filter Log:", stderrLine);
        }
      })
      .on("progress", (progress) => {
        if (!progress.percent) return;
        const value = Math.min(100, Math.max(0, Math.round(progress.percent)));
        if (value !== lastProgress) {
          lastProgress = value;
          onProgress?.(value);
        }
      })
      .on("end", () => resolve(outputPath))
      .on("error", (err) => {
        console.error("FFmpeg rendering error:", err);
        reject(err);
      });

    command.run();
  });
};