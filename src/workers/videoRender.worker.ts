import fs from "fs";
import path from "path";
import { Worker, Job } from "bullmq";
import { GeneratedVideo } from "../models/generatevideo.ts";
import { VIDEO_RENDER_QUEUE } from "../queues/videorender.ts";
import type { VideoRenderJobData } from "../types/redis.types.ts";
import { renderQuranOverlay } from "../services/quranOverlay.service.ts";
import { cloudinaryUploader } from "../cloudinary.ts";
import { redisConnection } from "../redis.ts";
import connectDB from "../db/index.ts";

const clearTempDir = async (jobId: string) => {
  const dir = path.join(process.cwd(), "tmp", jobId);
  if (fs.existsSync(dir)) {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
};

const updateRenderStatus = async (
  mongoRenderId: string,
  data: Partial<{
    status: string;
    progress: number;
    outputUrl: string;
    errorMessage: string;
  }>,
) => {
  await GeneratedVideo.findByIdAndUpdate(mongoRenderId, data, {
    returnDocument: "after",
  });
};

const initWorker = async () => {
  await connectDB();

  const worker = new Worker<VideoRenderJobData>(
    VIDEO_RENDER_QUEUE,
    async (job: Job<VideoRenderJobData>) => {
      const payload = job.data;

      if (!payload.mongoRenderId) {
        throw new Error("Missing mongoRenderId in render job");
      }

      await updateRenderStatus(payload.mongoRenderId, {
        status: "processing",
        progress: 10,
      });

      const jobId = job.id?.toString();
      if (!jobId) {
        throw new Error("Missing BullMQ job id");
      }
      const outputPath = await renderQuranOverlay({
        jobId,
        videoUrl: payload.videoUrl,
        audioUrl: payload.audioUrl,
        surahNumber: payload.surahNumber,
        ayahNumber: payload.ayahNumber,
        arabicText: payload.arabicText,
        translationText: payload.translationText,
        surahName: payload.surahName,
        onProgress: async (progress) => {
          await updateRenderStatus(payload.mongoRenderId, {
            progress,
          });
        },
      });

      const outputBuffer = await fs.promises.readFile(outputPath);
      const uploadResult = await cloudinaryUploader(
        outputBuffer,
        "quran_generated_videos",
        "video",
      );

      if (!uploadResult?.secure_url) {
        throw new Error("Cloudinary upload did not return a secure_url");
      }

      await updateRenderStatus(payload.mongoRenderId, {
        status: "completed",
        progress: 100,
        outputUrl: uploadResult.secure_url,
      });

      await clearTempDir(jobId);
      return {
        outputUrl: uploadResult.secure_url,
      };
    },
    { connection: redisConnection },
  );

  worker.on("failed", async (job: Job<VideoRenderJobData> | undefined, err) => {
    if (!job?.data?.mongoRenderId) return;
    await updateRenderStatus(job.data.mongoRenderId, {
      status: "failed",
      errorMessage: err?.message || "Render failed",
    });
  });

  worker.on("error", (error) => {
    console.error("Video render worker error:", error);
  });

  console.log("Video render worker started");
};

initWorker().catch((error) => {
  console.error("Failed to initialize video render worker:", error);
  process.exit(1);
});
