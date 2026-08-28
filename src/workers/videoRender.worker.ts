import dotenv from "dotenv";
import path from "path";

// 1. Initialize environment variables FIRST before loading DB modules
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import fs from "fs";
import type { Job } from "agenda";
import { exponential } from "agenda";
import type { VideoRenderJobData } from "../types/videoRenderJob.types.ts";
import { agenda, VIDEO_RENDER_JOB } from "../queues/videorender.ts";
import { findReciterConfig } from "../config/reciters.ts";
import { renderQuranOverlay } from "../services/quranOverlay.service.ts";

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

  agenda.define<VideoRenderJobData>(
    VIDEO_RENDER_JOB,
    async (job: Job<VideoRenderJobData>) => {
      const payload = job.attrs.data;

      if (!payload.mongoRenderId) {
        throw new Error("Missing mongoRenderId in render job");
      }

      const jobId = job.attrs._id?.toString();
      if (!jobId) {
        throw new Error("Missing Agenda job id");
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
      } catch (error) {
        // Let Agenda's backoff decide whether to retry; only log here
        console.error(
          `Video render job ${jobId} attempt failed:`,
          (error as Error).message,
        );
        throw error;
      } finally {
        await clearTempDir(jobId);
      }
    },
    {
      lockLifetime: Number(process.env.RENDER_TIMEOUT_MS) || 900000,
      concurrency: 1,
      backoff: exponential({ delay: 5000, maxRetries: 2 }), // 2 retries = 3 total attempts
    },
  );

  // Fires once Agenda gives up retrying — mirrors the old BullMQ "failed" handler
  agenda.on(
    `retry exhausted:${VIDEO_RENDER_JOB}`,
    async (error: Error, job) => {
      const mongoRenderId = (job.attrs.data as VideoRenderJobData | undefined)
        ?.mongoRenderId;
      console.error(
        "Video render job failed permanently:",
        job.attrs._id?.toString(),
        "error:",
        error,
      );
      if (!mongoRenderId) return;
      await updateRenderStatus(mongoRenderId, {
        status: "failed",
        errorMessage: error?.message || "Render failed",
      });
    },
  );

  await agenda.start();
  console.log("Video render worker started");
};

initWorker().catch((error) => {
  console.error("Failed to initialize video render worker:", error);
  process.exit(1);
});
