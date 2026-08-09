import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

ffmpeg.setFfmpegPath(ffmpegStatic as any);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TMP_ROOT = path.resolve("tmp");

// 1. Convert Windows backslashes to forward slashes.
// DO NOT escape the colon when wrapping the path in single quotes inside drawtext!
const rawFontPath = path.join(__dirname, "../fonts/Amiri-Regular.ttf");
const arabicFontPath = rawFontPath.replace(/\\/g, "/");

const ensureTempDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// 2. Safe escaping for FFmpeg drawtext parameters inside single quotes
const escapeFfmpegText = (value: string) => {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "'\\\\''") // Escapes single quotes for FFmpeg
    .replace(/:/g, "\\:")
    .replace(/%/g, "%%")
    .replace(/\n/g, "\\n");
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
  surahName,
  onProgress,
}: OverlayRenderParams): Promise<string> => {
  const jobDir = path.join(TMP_ROOT, String(jobId));
  ensureTempDir(jobDir);

  const videoPath = path.join(jobDir, "template.mp4");
  const audioPath = path.join(jobDir, "audio.mp3");
  const outputPath = path.join(jobDir, "output.mp4");

  await Promise.all([
    downloadFile(videoUrl, videoPath),
    downloadFile(audioUrl, audioPath),
  ]);

  if (!fs.existsSync(rawFontPath)) {
    throw new Error(
      `Arabic font not found at ${rawFontPath}. Place Amiri-Regular.ttf in src/fonts/`,
    );
  }

  const escapedArabicText = escapeFfmpegText(arabicText);
  const escapedTranslationText = escapeFfmpegText(translationText);

  // 3. Chain drawtext filters together using a comma
  const filterGraph = [
    `drawtext=fontfile='${arabicFontPath}':text='${escapedArabicText}':fontcolor=white:fontsize=64:box=1:boxcolor=black@0.4:boxborderw=12:x=(w-tw)/2:y=(h-th)/2.5`,
    `drawtext=fontfile='${arabicFontPath}':text='${escapedTranslationText}':fontcolor=white:fontsize=32:box=1:boxcolor=black@0.4:boxborderw=8:x=(w-tw)/2:y=(h-th)/1.8`,
  ].join(",");

  return new Promise<string>((resolve, reject) => {
    let lastProgress = 0;

    const command = ffmpeg()
      .input(videoPath)
      .inputOptions(["-stream_loop", "-1"])
      .input(audioPath)
      .complexFilter(filterGraph) // Pass string directly, NOT inside an array
      .outputOptions([
        "-map",
        "0:v",
        "-map",
        "1:a",
        "-c:v",
        "libx264",
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
        console.debug("ffmpeg:", stderrLine);
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
      .on("error", (err) => reject(err));

    command.run();
  });
};
