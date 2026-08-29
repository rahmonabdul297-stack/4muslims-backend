import type { Request, Response } from "express";
import {
  cleanupOldGeneratedVideos,
  getStorageUsageSummary,
} from "../../services/storageCleanup.service.ts";
import { sendErrorResponse, sendSuccessResponse } from "../../utils/helper.ts";

/**
 * Get storage usage summary
 * Returns: total videos, admin-posted count, user-generated count, old videos eligible for deletion
 */
export const getStorageStats = async (req: Request, res: Response) => {
  try {
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
    const result = await cleanupOldGeneratedVideos();

    if (result.errors.length > 0) {
      return sendSuccessResponse(res, "Cleanup completed with errors", result);
    }

    return sendSuccessResponse(
      res,
      `Successfully deleted ${result.deletedCount} old videos`,
      result,
    );
  } catch (error) {
    return sendErrorResponse(
      res,
      `Storage cleanup failed: ${(error as Error).message}`,
      500,
    );
  }
};
