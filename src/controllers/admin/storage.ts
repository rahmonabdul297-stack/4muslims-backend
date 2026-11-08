import type { Request, Response } from "express";
import { enqueueJob, STORAGE_CLEANUP_JOB } from "../../jobs/job-queue.ts";
import { sendErrorResponse, sendSuccessResponse } from "../../utils/helper.ts";

/**
 * Get storage usage summary
 * Returns: total videos, admin-posted count, user-generated count, old videos eligible for deletion
 */
export const getStorageStats = async (req: Request, res: Response) => {
  try {
    const { getStorageUsageSummary } =
      await import("../../services/storageCleanup.service.ts");
    const stats = await getStorageUsageSummary();

    return sendSuccessResponse(
      res,
      "Storage stats retrieved successfully",
      stats,
    );
  } catch (error) {
    return sendErrorResponse(
      res,
      `Failed to retrieve storage stats: ${(error as Error).message}`,
      500,
    );
  }
};

/**
 * Manually trigger storage cleanup
 * Deletes videos older than 3 days (user-generated only)
 */
export const triggerStorageCleanup = async (req: Request, res: Response) => {
  try {
    const job = await enqueueJob(STORAGE_CLEANUP_JOB, {});
    return sendSuccessResponse(res, "Storage cleanup has been queued", {
      jobId: String(job._id),
    });
  } catch (error) {
    return sendErrorResponse(
      res,
      `Storage cleanup could not be queued: ${(error as Error).message}`,
      500,
    );
  }
};
