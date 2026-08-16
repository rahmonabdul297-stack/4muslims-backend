import dotenv from "dotenv";
import path from "path";

// 1. Initialize environment variables FIRST before loading DB modules
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import fs from "fs";
import { Worker, Job } from "bullmq";
import type { VideoRenderJobData } from "../types/redis.types.ts";
import { VIDEO_RENDER_QUEUE } from "../queues/videorender.ts";
import { findReciterConfig } from "../config/reciters.ts";
import { renderQuranOverlay } from "../services/quranOverlay.service.ts";
import { redisConnection } from "../redis.ts";

const clearTempDir = async (jobId: string) => {
  const dir = path.join(process.cwd(), "tmp", jobId);
  if (fs.existsSync(dir)) {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
};

const initWorker = async () => {
  // 2. Dynamically import DB and Models AFTER dotenv has populated process.env
  const { default: connectDB } = await import("../db/index.ts");
  const { GeneratedVideo } = await import("../models/generatevideo.ts");

  await connectDB();

  const updateRenderStatus = async (
    mongoRenderId: string,
    data: Partial<{
      status: string;
      progress: number;
      outputUrl: string;
      errorMessage: string;
      audioUrl?: string;
      globalAyahNumber?: number;
    }>,
  ) => {
    await GeneratedVideo.findByIdAndUpdate(mongoRenderId, data, {
      returnDocument: "after",
    });
  };

  const worker = new Worker<VideoRenderJobData>(
    VIDEO_RENDER_QUEUE,
    async (job: Job<VideoRenderJobData>) => {
      const payload = job.data;

      if (!payload.mongoRenderId) {
        throw new Error("Missing mongoRenderId in render job");
      }

      const jobId = job.id?.toString();
      if (!jobId) {
        throw new Error("Missing BullMQ job id");
      }

      const reciterConfig = findReciterConfig(payload.reciterId);
      if (!reciterConfig) {
        throw new Error(`Invalid reciterId: ${payload.reciterId}`);
      }

      await updateRenderStatus(payload.mongoRenderId, {
        status: "processing",
        progress: 10,
        audioUrl: payload.audioUrl,
        globalAyahNumber: payload.globalAyahNumber,
      });

      console.log(
        "[videoRender.worker] processing audioUrl=",
        payload.audioUrl,
        {
          jobId,
          mongoRenderId: payload.mongoRenderId,
          surahNumber: payload.surahNumber,
          ayahNumber: payload.ayahNumber,
          reciterId: payload.reciterId,
          reciterName: reciterConfig.name,
        },
      );

      let lastReportedProgress = 10;
      let isUpdatingDb = false;

      try {
        const outputUrl = await renderQuranOverlay({
          jobId,
          videoUrl: payload.videoUrl,
          audioUrl: payload.audioUrl,
          surahNumber: payload.surahNumber,
          ayahNumber: payload.ayahNumber,
          arabicText: payload.arabicText,
          translationText: payload.translationText,
          surahName: payload.surahName,
          onProgress: async (progress) => {
            await job.updateProgress(progress);

            if (progress > lastReportedProgress && !isUpdatingDb) {
              lastReportedProgress = progress;
              isUpdatingDb = true;

              updateRenderStatus(payload.mongoRenderId, { progress })
                .catch((err) =>
                  console.error("Failed to update progress in DB:", err),
                )
                .finally(() => {
                  isUpdatingDb = false;
                });
            }
          },
        });

        await updateRenderStatus(payload.mongoRenderId, {
          status: "completed",
          progress: 100,
          outputUrl,
        });

        return { outputUrl };
      } catch (error) {
        throw error;
      } finally {
        await clearTempDir(jobId);
      }
    },
    {
      connection: redisConnection,
      concurrency: 1,
      lockDuration: 300000,
      lockRenewTime: 15000,
      stalledInterval: 30000,
      maxStalledCount: 2,
    },
  );

  worker.on("failed", async (job: Job<VideoRenderJobData> | undefined, err) => {
    console.error(
      "Video render job failed:",
      job?.id,
      "payload:",
      job?.data,
      "error:",
      err,
    );
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
