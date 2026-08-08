import fs from "fs";
import path from "path";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import canvas from "@napi-rs/canvas";
import ffmpegStatic from "ffmpeg-static";

ffmpeg.setFfmpegPath(ffmpegStatic as any);

const TMP_ROOT = path.resolve("tmp");

const ensureTempDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const downloadFile = async (url: string, outputPath: string) => {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
  });
  await fs.promises.writeFile(outputPath, Buffer.from(response.data));
};

const renderOverlayImage = async (
  jobId: string,
  surahNumber: number,
  ayahNumber: number,
  arabicText: string,
  translationText: string,
  surahName?: string,
) => {
  const jobDir = path.join(TMP_ROOT, jobId);
  const overlayPath = path.join(jobDir, "overlay.png");
  const width = 1080;
  const height = 1920;
  const surface = canvas.createCanvas(width, height);
  const ctx = surface.getContext("2d");

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  const cardX = 60;
  const cardY = 220;
  const cardW = width - 120;
  const cardH = 1300;
  const radius = 40;
  ctx.beginPath();
  ctx.moveTo(cardX + radius, cardY);
  ctx.lineTo(cardX + cardW - radius, cardY);
  ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + radius);
  ctx.lineTo(cardX + cardW, cardY + cardH - radius);
  ctx.quadraticCurveTo(
    cardX + cardW,
    cardY + cardH,
    cardX + cardW - radius,
    cardY + cardH,
  );
  ctx.lineTo(cardX + radius, cardY + cardH);
  ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - radius);
  ctx.lineTo(cardX, cardY + radius);
  ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 52px Sans";
  ctx.textAlign = "center";
  const headerText = surahName
    ? `${surahName.toUpperCase()} - AYAH ${ayahNumber}`
    : `SURAH ${surahNumber} : AYAH ${ayahNumber}`;
  ctx.fillText(headerText, width / 2, cardY + 80);

  ctx.font = "bold 90px Sans";
  ctx.textAlign = "right";
  ctx.fillText(arabicText, cardX + cardW - 40, cardY + 260);

  ctx.font = "36px Sans";
  ctx.textAlign = "left";
  const translationLines = translationText
    .split("\n")
    .map((line) => line.trim());
  let translateY = cardY + 420;
  for (const line of translationLines) {
    ctx.fillText(line, cardX + 50, translateY);
    translateY += 46;
  }

  await fs.promises.writeFile(overlayPath, surface.toBuffer("image/png"));
  return overlayPath;
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
  const jobDir = path.join(TMP_ROOT, jobId);
  ensureTempDir(jobDir);

  const videoPath = path.join(jobDir, "template.mp4");
  const audioPath = path.join(jobDir, "audio.mp3");
  const outputPath = path.join(jobDir, "output.mp4");

  await Promise.all([
    downloadFile(videoUrl, videoPath),
    downloadFile(audioUrl, audioPath),
  ]);

  await renderOverlayImage(
    jobId,
    surahNumber,
    ayahNumber,
    arabicText,
    translationText,
    surahName,
  );

  const overlayPath = path.join(jobDir, "overlay.png");

  return new Promise<string>((resolve, reject) => {
    let lastProgress = 0;
    const command = ffmpeg()
      .input(videoPath)
      .inputOptions(["-stream_loop -1"])
      .input(overlayPath)
      .input(audioPath)
      .complexFilter(["[0:v][1:v]overlay=0:0:shortest=1[outv]"])
      .outputOptions([
        "-map [outv]",
        "-map 2:a",
        "-c:v libx264",
        "-c:a aac",
        "-preset ultrafast",
        "-shortest",
      ])
      .output(outputPath)
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
