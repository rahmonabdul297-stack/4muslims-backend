import { randomUUID } from "crypto";
import mongoose, { Schema } from "mongoose";
import { isValidObjectId } from "mongoose";
import type { VideoRenderJobData } from "../types/videoRenderJob.types.ts";

export const VIDEO_RENDER_JOB = "render-video";
export const AUTOPOST_JOB = "autopost-user";
export const STORAGE_CLEANUP_JOB = "storage-cleanup";

export type QueueJobType =
  | typeof VIDEO_RENDER_JOB
  | typeof AUTOPOST_JOB
  | typeof STORAGE_CLEANUP_JOB;

type QueueJobPayload =
  | VideoRenderJobData
  | { userId: string }
  | Record<string, never>;

interface QueueJob {
  type: QueueJobType;
  payload: QueueJobPayload;
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  availableAt: Date;
  lockedAt?: Date;
  lockToken?: string;
  lastError?: string;
}

const queueJobSchema = new Schema<QueueJob>(
  {
    type: {
      type: String,
      enum: [VIDEO_RENDER_JOB, AUTOPOST_JOB, STORAGE_CLEANUP_JOB],
      required: true,
    },
    payload: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      required: true,
    },
    attempts: { type: Number, default: 0, required: true },
    availableAt: { type: Date, default: Date.now, required: true },
    lockedAt: { type: Date },
    lockToken: { type: String },
    lastError: { type: String },
  },
  { timestamps: true, collection: "serverlessJobs" },
);

queueJobSchema.index({ status: 1, availableAt: 1, createdAt: 1 });
queueJobSchema.index({ status: 1, lockedAt: 1 });

const QueueJobModel =
  (mongoose.models.ServerlessJob as
    | mongoose.Model<QueueJob>
    | undefined) ?? mongoose.model<QueueJob>("ServerlessJob", queueJobSchema);

interface QueueLock {
  _id: string;
  lockedAt?: Date;
  lockToken?: string;
}

const queueLockSchema = new Schema<QueueLock>(
  {
    _id: { type: String, required: true },
    lockedAt: { type: Date },
    lockToken: { type: String },
  },
  { collection: "serverlessQueueLocks", versionKey: false },
);

const QueueLockModel =
  (mongoose.models.ServerlessQueueLock as
    | mongoose.Model<QueueLock>
    | undefined) ??
  mongoose.model<QueueLock>("ServerlessQueueLock", queueLockSchema);

const MAX_ATTEMPTS = 3;
const LOCK_TIMEOUT_MS = 6 * 60 * 1000;

export const enqueueJob = async (
  type: QueueJobType,
  payload: QueueJobPayload,
) => {
  const job = await QueueJobModel.create({ type, payload });
  return job;
};

export const getQueueJobStatus = async (jobId: string) => {
  if (!isValidObjectId(jobId)) return null;
  return QueueJobModel.findById(jobId)
    .select("type status attempts availableAt lastError createdAt updatedAt")
    .lean();
};

const claimNextJob = async () => {
  const now = new Date();
  const expiredBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS);

  const exhaustedJobFilter = {
    status: "processing" as const,
    lockedAt: { $lte: expiredBefore },
    attempts: { $gte: MAX_ATTEMPTS },
  };
  const exhaustedRenderJobs = await QueueJobModel.find({
    ...exhaustedJobFilter,
    type: VIDEO_RENDER_JOB,
  })
    .select("payload")
    .lean();

  await QueueJobModel.updateMany(
    exhaustedJobFilter,
    {
      $set: { status: "failed", lastError: "Job exceeded retry limit." },
      $unset: { lockToken: "", lockedAt: "" },
    },
  );

  if (exhaustedRenderJobs.length > 0) {
    const renderIds = exhaustedRenderJobs
      .map((job) => (job.payload as VideoRenderJobData).mongoRenderId)
      .filter(Boolean);
    if (renderIds.length > 0) {
      const { GeneratedVideo } = await import("../models/generatevideo.ts");
      await GeneratedVideo.updateMany(
        { _id: { $in: renderIds }, status: "processing" },
        {
          $set: {
            status: "failed",
            errorMessage: "Video render exceeded the retry limit.",
          },
        },
      );
    }
  }

  return QueueJobModel.findOneAndUpdate(
    {
      attempts: { $lt: MAX_ATTEMPTS },
      $or: [
        { status: "pending", availableAt: { $lte: now } },
        { status: "processing", lockedAt: { $lte: expiredBefore } },
      ],
    },
    {
      $set: {
        status: "processing",
        lockedAt: now,
        lockToken: randomUUID(),
        lastError: "",
      },
      $inc: { attempts: 1 },
    },
    { returnDocument: "after", sort: { createdAt: 1 } },
  );
};

const acquireProcessorLock = async (): Promise<string | undefined> => {
  const now = new Date();
  const lockToken = randomUUID();
  const expiredBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS);

  try {
    const lock = await QueueLockModel.findOneAndUpdate(
      {
        _id: "global",
        $or: [
          { lockedAt: { $exists: false } },
          { lockedAt: { $lte: expiredBefore } },
        ],
      },
      { $set: { lockedAt: now, lockToken } },
      { returnDocument: "after", upsert: true },
    );
    return lock?.lockToken === lockToken ? lockToken : undefined;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return undefined;
    }
    throw error;
  }
};

const executeJob = async (type: QueueJobType, payload: QueueJobPayload) => {
  switch (type) {
    case VIDEO_RENDER_JOB: {
      const renderPayload = payload as VideoRenderJobData;
      const { GeneratedVideo } = await import("../models/generatevideo.ts");
      const { renderQuranOverlay } =
        await import("../services/quranOverlay.service.ts");

      await GeneratedVideo.findByIdAndUpdate(renderPayload.mongoRenderId, {
        status: "processing",
        progress: 10,
        audioUrl: renderPayload.audioUrl,
        globalAyahNumber: renderPayload.globalAyahNumber,
      });

      const result = await renderQuranOverlay({
        jobId: renderPayload.mongoRenderId,
        videoUrl: renderPayload.videoUrl,
        audioUrl: renderPayload.audioUrl,
        surahNumber: renderPayload.surahNumber,
        ayahNumber: renderPayload.ayahNumber,
        arabicText: renderPayload.arabicText,
        translationText: renderPayload.translationText,
        surahName: renderPayload.surahName,
      });

      await GeneratedVideo.findByIdAndUpdate(renderPayload.mongoRenderId, {
        status: "completed",
        progress: 100,
        outputUrl: result.outputUrl,
        cloudinaryPublicId: result.cloudinaryPublicId,
      });
      return;
    }

    case AUTOPOST_JOB: {
      const autoPostPayload = payload as { userId: string };
      if (!autoPostPayload.userId) {
        throw new Error("Missing userId in auto-post job.");
      }
      const { executeAutoPostForUser } = await import("./autopost.job.ts");
      await executeAutoPostForUser(autoPostPayload.userId);
      return;
    }

    case STORAGE_CLEANUP_JOB: {
      const { cleanupOldGeneratedVideos } =
        await import("../services/storageCleanup.service.ts");
      const result = await cleanupOldGeneratedVideos();
      if (result.failedCount > 0 || result.errors.length > 0) {
        throw new Error(
          `Storage cleanup failed for ${result.failedCount} item(s): ${result.errors.join("; ")}`,
        );
      }
    }
  }
};

export const processNextJob = async () => {
  const processorLock = await acquireProcessorLock();
  if (!processorLock) return { processed: false as const, busy: true };
  try {
    const job = await claimNextJob();
    if (!job) {
      return { processed: false as const, busy: false };
    }

    const lockToken = job.lockToken;
    if (!lockToken) {
      throw new Error(`Claimed job ${job.id} has no lock token.`);
    }

    try {
      await executeJob(job.type, job.payload);
      await QueueJobModel.updateOne(
        { _id: job._id, lockToken },
        {
          $set: { status: "completed", lastError: "" },
          $unset: { lockedAt: "", lockToken: "" },
        },
      );
      return {
        processed: true as const,
        success: true,
        jobId: String(job._id),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retry = job.attempts < MAX_ATTEMPTS;
      const availableAt = new Date(
        Date.now() + Math.min(60_000, 5_000 * 2 ** (job.attempts - 1)),
      );

      if (job.type === VIDEO_RENDER_JOB) {
        const { GeneratedVideo } = await import("../models/generatevideo.ts");
        const renderPayload = job.payload as VideoRenderJobData;
        await GeneratedVideo.findByIdAndUpdate(renderPayload.mongoRenderId, {
          status: retry ? "pending" : "failed",
          ...(retry ? {} : { errorMessage: message }),
        });
      }

      await QueueJobModel.updateOne(
        { _id: job._id, lockToken },
        {
          $set: {
            status: retry ? "pending" : "failed",
            availableAt,
            lastError: message,
          },
          $unset: { lockedAt: "", lockToken: "" },
        },
      );

      console.error(`[jobQueue] Job ${job.id} failed:`, error);
      return {
        processed: true as const,
        success: false,
        jobId: String(job._id),
        status: retry ? "pending" : "failed",
        error: message,
      };
    }
  } finally {
    await QueueLockModel.updateOne(
      { _id: "global", lockToken: processorLock },
      { $unset: { lockedAt: "", lockToken: "" } },
    );
  }
};
