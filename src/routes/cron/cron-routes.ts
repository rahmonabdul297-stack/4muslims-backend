import { Router } from "express";
import { User } from "../../models/User.ts";
import {
  AUTOPOST_JOB,
  enqueueJob,
  getQueueJobStatus,
  processNextJob,
  STORAGE_CLEANUP_JOB,
} from "../../jobs/job-queue.ts";

const router = Router();

router.use((req, res, next) => {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET is not configured.");
    res.status(503).json({ success: false, message: "Cron is not configured" });
    return;
  }

  if (req.get("authorization") !== `Bearer ${cronSecret}`) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  next();
});

router.get("/auto-post", async (_req, res) => {
  try {
    const users = await User.find({
      "autoPostSettings.enabled": true,
      subscriptionStatus: "active",
    }).select("_id");

    let enqueuedCount = 0;
    const failedUserIds: string[] = [];

    for (const user of users) {
      try {
        await enqueueJob(AUTOPOST_JOB, { userId: String(user._id) });
        enqueuedCount++;
      } catch (error) {
        console.error(
          `[autopost] Failed to enqueue user ${user._id}:`,
          error,
        );
        failedUserIds.push(String(user._id));
      }
    }

    const success = failedUserIds.length === 0;
    res.status(success ? 200 : 500).json({
      success,
      enqueuedCount,
      failedCount: failedUserIds.length,
      failedUserIds,
    });
  } catch (error) {
    console.error("[autopost] Failed to enqueue scheduled jobs:", error);
    res.status(500).json({ success: false, message: "Auto-post enqueue failed" });
  }
});

router.get("/storage-cleanup", async (_req, res) => {
  try {
    const job = await enqueueJob(STORAGE_CLEANUP_JOB, {});
    res.status(202).json({
      success: true,
      message: "Storage cleanup has been queued.",
      jobId: String(job._id),
    });
  } catch (error) {
    console.error("[storageCleanup] Failed to enqueue cleanup:", error);
    res.status(500).json({
      success: false,
      message: "Storage cleanup could not be queued",
    });
  }
});

router.get("/process-jobs", async (_req, res) => {
  try {
    const result = await processNextJob();
    res.status(result.processed && !result.success ? 500 : 200).json({
      success: !result.processed || result.success,
      ...result,
    });
  } catch (error) {
    console.error("[jobQueue] Failed to process queued job:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process queued job",
    });
  }
});

router.get("/jobs/:jobId", async (req, res) => {
  try {
    const job = await getQueueJobStatus(req.params.jobId);
    if (!job) {
      res.status(404).json({ success: false, message: "Job not found" });
      return;
    }
    res.status(200).json({ success: true, data: job });
  } catch (error) {
    console.error("[jobQueue] Failed to read job status:", error);
    res.status(500).json({ success: false, message: "Could not read job status" });
  }
});

export default router;
