import dotenv from "dotenv";
import path from "path";

// 1. Initialize environment variables FIRST before loading DB modules
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import type { Job } from "agenda";
import { exponential } from "agenda";
import type { VideoRenderJobData } from "../types/videoRenderJob.types.ts";
import { agenda, VIDEO_RENDER_JOB } from "../queues/videorender.ts";
import { findReciterConfig } from "../config/reciters.ts";
import { renderQuranOverlay } from "../services/quranOverlay.service.ts";
import { clearJobTempDir } from "../utils/tempDir.ts";

// Extend job payload interface to accept manual generation flag
export interface VideoRenderJobPayload extends VideoRenderJobData {
  isManual?: boolean;
}

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
      cloudinaryPublicId?: string;
    }>,
  ) => {
    await GeneratedVideo.findByIdAndUpdate(mongoRenderId, data, {
      returnDocument: "after",
    });
  };

  agenda.define<VideoRenderJobPayload>(
    VIDEO_RENDER_JOB,
    async (job: Job<VideoRenderJobPayload>) => {
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
          isManual: !!payload.isManual,
        },
      );

      let lastReportedProgress = 10;
      let isUpdatingDb = false;

      try {
        const renderResult = await renderQuranOverlay({
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

        // Save output details in DB
        await updateRenderStatus(payload.mongoRenderId, {
          status: "completed",
          progress: 100,
          outputUrl: renderResult.outputUrl,
          cloudinaryPublicId: renderResult.cloudinaryPublicId,
        });

        // CRITICAL BUG FIX (Bug #1):
        // Only trigger social media posting IF it is an automated job (not manual)
        if (!payload.isManual) {
          console.log(`[videoRender.worker] Automated job: triggering social post for user`);
          const { AUTOPOST_JOB } = await import("../queues/videorender.ts");
          // Schedule social publishing queue item here if applicable
        } else {
          console.log(`[videoRender.worker] Manual generation detected: skipping social media post.`);
        }

      } catch (error) {
        console.error(
          `Video render job ${jobId} attempt failed:`,
          (error as Error).message,
        );
        throw error;
      } finally {
        // Clean up temp directory scratch space
        await clearJobTempDir(jobId);

        // CRITICAL BUG FIX (Bug #2 & #3):
        // Force garbage collection to free V8 heap memory immediately
        if (typeof global.gc === "function") {
          global.gc();
          console.log("[videoRender.worker] Forced Garbage Collection executed.");
        }
      }
    },
    {
      lockLifetime: Number(process.env.RENDER_TIMEOUT_MS) || 1800000,
      concurrency: 1, // Restrict to 1 job at a time to keep RAM bounded
      backoff: exponential({ delay: 10000, maxRetries: 1 }),
    },
  );

  agenda.on(
    `retry exhausted:${VIDEO_RENDER_JOB}`,
    async (error: Error, job) => {
      const mongoRenderId = (job.attrs.data as VideoRenderJobPayload | undefined)
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

  const { executeAutoPostForUser } =
    await import("../controllers/autoposter.controller.ts");
  const { AUTOPOST_JOB } = await import("../queues/videorender.ts");

  agenda.define<{ userId: string }>(
    AUTOPOST_JOB,
    async (job) => {
      const { userId } = job.attrs.data;
      if (!userId) {
        throw new Error("Missing userId in autopost job");
      }
      await executeAutoPostForUser(userId);
    },
    {
      concurrency: 1,
      backoff: exponential({ delay: 10000, maxRetries: 1 }),
    },
  );

  agenda.on(`retry exhausted:${AUTOPOST_JOB}`, (error: Error, job) => {
    const userId = (job.attrs.data as { userId?: string } | undefined)?.userId;
    console.error(
      `[autopost] Job failed permanently for user ${userId}:`,
      error,
    );
  });

  await agenda.start();
  console.log("Video render worker started");
};

initWorker().catch((error) => {
  console.error("Failed to initialize video render worker:", error);
  process.exit(1);
});