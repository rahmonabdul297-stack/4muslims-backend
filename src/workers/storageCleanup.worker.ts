import cron from "node-cron";
import { cleanupOldGeneratedVideos } from "../services/storageCleanup.service.ts";

/**
 * Storage cleanup worker
 * Runs once daily at 02:00 UTC to delete generated videos older than 3 days
 * Excludes admin-posted videos
 */
const scheduleStorageCleanup = () => {
  // Run at 02:00 UTC daily (2 AM UTC = most users are sleeping)
  cron.schedule("0 2 * * *", async () => {
    try {
      console.log(
        "[storageCleanupWorker] Starting scheduled storage cleanup...",
      );
      const result = await cleanupOldGeneratedVideos();

      console.log(
        `[storageCleanupWorker] Cleanup completed - Deleted: ${result.deletedCount}, Failed: ${result.failedCount}`,
      );

      if (result.errors.length > 0) {
        console.warn(
          `[storageCleanupWorker] Errors during cleanup:`,
          result.errors,
        );
      }
    } catch (error) {
      console.error(
        `[storageCleanupWorker] Unexpected error:`,
        (error as Error).message,
      );
    }
  });

  console.log(
    "[storageCleanupWorker] Scheduled storage cleanup at 02:00 UTC daily",
  );
};

// Start the worker
scheduleStorageCleanup();
