import fs from "fs";
import path from "path";
import { Worker, Job } from "bullmq";
import { GeneratedVideo } from "../models/generatevideo.ts";
import { VIDEO_RENDER_QUEUE } from "../queues/videorender.ts";
import type { VideoRenderJobData } from "../types/redis.types.ts";
import { renderQuranOverlay } from "../services/quranOverlay.service.ts";

import { redisConnection } from "../redis.ts";
import connectDB from "../db/index.ts";
import { findReciterConfig } from "../config/reciters.ts";

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
    audioUrl?: string;
    globalAyahNumber?: number;
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
        audioUrl: payload.audioUrl,
        globalAyahNumber: payload.globalAyahNumber,
      } as any);

      const jobId = job.id?.toString();
      if (!jobId) {
        throw new Error("Missing BullMQ job id");
      }

      const reciterConfig = findReciterConfig(payload.reciterId);
      if (!reciterConfig) {
        throw new Error(`Invalid reciterId: ${payload.reciterId}`);
      }
      const audioUrl = payload.audioUrl;

      console.log("[videoRender.worker] processing audioUrl=", audioUrl, {
        jobId,
        mongoRenderId: payload.mongoRenderId,
        surahNumber: payload.surahNumber,
        ayahNumber: payload.ayahNumber,
        reciterId: payload.reciterId,
        reciterName: reciterConfig.name,
      });

      // Track last reported progress percentage to avoid spamming MongoDB
      let lastReportedProgress = 10;

      try {
        const outputUrl = await renderQuranOverlay({
          jobId,
          videoUrl: payload.videoUrl,
          audioUrl,
          surahNumber: payload.surahNumber,
          ayahNumber: payload.ayahNumber,
          arabicText: payload.arabicText,
          translationText: payload.translationText,
          surahName: payload.surahName,
          onProgress: async (progress) => {
            // Only write to DB & Redis if the integer percentage has actually increased
            if (progress > lastReportedProgress) {
              lastReportedProgress = progress;

              // 1. Send heartbeat to BullMQ so the lock doesn't stall
              await job.updateProgress(progress);

              // 2. Update MongoDB asynchronously without blocking execution
              updateRenderStatus(payload.mongoRenderId, { progress }).catch(
                (err) => console.error("Failed to update progress in DB:", err),
              );
            }
          },
        });

        await updateRenderStatus(payload.mongoRenderId, {
          status: "completed",
          progress: 100,
          outputUrl,
        });

        return {
          outputUrl,
        };
      } catch (error) {
        await updateRenderStatus(payload.mongoRenderId, {
          status: "failed",
          errorMessage: (error as Error)?.message || "Render failed",
        });
        throw error;
      } finally {
        await clearTempDir(jobId);
      }
    },
    {
      connection: redisConnection,
      concurrency: 1, // Recommended: set to 1 unless running on 4+ core dedicated CPUs
      lockDuration: 300000, // 5 minutes
      lockRenewTime: 15000, // Automatically renew Redis lock every 15 seconds
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
