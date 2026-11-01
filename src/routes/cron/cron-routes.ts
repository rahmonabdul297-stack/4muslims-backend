import { Router } from "express";
import { agenda, AUTOPOST_JOB } from "../../queues/videorender.ts";
import { cleanupOldGeneratedVideos } from "../../services/storageCleanup.service.ts";
import { User } from "../../models/User.ts";

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
        await agenda.now(AUTOPOST_JOB, { userId: String(user._id) });
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
    const result = await cleanupOldGeneratedVideos();
    const success = result.failedCount === 0 && result.errors.length === 0;

    res.status(success ? 200 : 500).json({
      success,
      deletedCount: result.deletedCount,
      failedCount: result.failedCount,
      errors: result.errors,
    });
  } catch (error) {
    console.error("[storageCleanup] Scheduled cleanup failed:", error);
    res.status(500).json({ success: false, message: "Storage cleanup failed" });
  }
});

export default router;
