import { v2 as cloudinary } from "cloudinary";
import { GeneratedVideo } from "../models/generatevideo.ts";

const ensureCloudinaryConfig = () => {
  const cloudName = process.env.CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUD_API_KEY?.trim();
  const apiSecret = process.env.CLOUD_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary config missing: CLOUD_NAME, CLOUD_API_KEY, and CLOUD_API_SECRET must be set.",
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
    timeout: 300000,
  });
};

ensureCloudinaryConfig();

/**
 * Delete a single video from Cloudinary
 * Handles both video and image resources
 */
const deleteFromCloudinary = async (
  publicId: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!publicId) {
      return { success: false, error: "Missing public_id" };
    }

    // Try to delete as video first
    const videoResult = await cloudinary.uploader.destroy(publicId, {
      resource_type: "video",
      invalidate: true, // Invalidate CDN cache
    });

    // If video deletion failed (not found), try as image
    if (videoResult.result === "not found") {
      const imageResult = await cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
      });

      if (imageResult.result === "ok") {
        console.log(
          `[storageCleanup] Deleted image from Cloudinary: ${publicId}`,
        );
        return { success: true };
      }
    } else if (videoResult.result === "ok") {
      console.log(
        `[storageCleanup] Deleted video from Cloudinary: ${publicId}`,
      );
      return { success: true };
    }

    return {
      success: false,
      error: `Cloudinary deletion failed: ${videoResult.result}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Cloudinary error: ${(error as Error).message}`,
    };
  }
};

/**
 * Clean up generated videos older than 3 days
 * Excludes videos marked as admin-posted
 * Deletes from both Cloudinary and MongoDB
 */
export const cleanupOldGeneratedVideos = async (): Promise<{
  deletedCount: number;
  failedCount: number;
  errors: string[];
}> => {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  try {
    // Find all user-generated videos (not admin-posted) older than 3 days
    const videosToDelete = await GeneratedVideo.find({
      createdAt: { $lt: threeDaysAgo },
      isAdminPosted: { $ne: true }, // Exclude admin-posted videos
      status: { $ne: "processing" }, // Don't delete videos still being processed
    });

    console.log(
      `[storageCleanup] Found ${videosToDelete.length} videos older than 3 days`,
    );

    let deletedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Delete each video from Cloudinary first, then from MongoDB
    for (const video of videosToDelete) {
      try {
        // Step 1: Delete from Cloudinary if public_id exists
        if (video.cloudinaryPublicId) {
          const cloudinaryResult = await deleteFromCloudinary(
            video.cloudinaryPublicId,
          );

          if (!cloudinaryResult.success) {
            const errorMsg = `Failed to delete ${video._id} from Cloudinary: ${cloudinaryResult.error}`;
            errors.push(errorMsg);
            console.warn(`[storageCleanup] ${errorMsg}`);
            failedCount++;
            continue;
          }
        }

        // Step 2: Delete from MongoDB (keep going even if Cloudinary deletion partially failed)
        await GeneratedVideo.findByIdAndDelete(video._id);
        deletedCount++;

        console.log(
          `[storageCleanup] Deleted video ${video._id} (created ${video.createdAt})`,
        );
      } catch (error) {
        const errorMsg = `Error deleting video ${video._id}: ${(error as Error).message}`;
        errors.push(errorMsg);
        console.error(`[storageCleanup] ${errorMsg}`);
        failedCount++;
      }
    }

    const summary = {
      deletedCount,
      failedCount,
      errors,
    };

    console.log(
      `[storageCleanup] Cleanup complete: ${deletedCount} deleted, ${failedCount} failed`,
    );

    return summary;
  } catch (error) {
    const errorMsg = `Storage cleanup failed: ${(error as Error).message}`;
    console.error(`[storageCleanup] ${errorMsg}`);
    return {
      deletedCount: 0,
      failedCount: 0,
      errors: [errorMsg],
    };
  }
};

/**
 * Get storage usage summary
 */
export const getStorageUsageSummary = async (): Promise<{
  totalVideos: number;
  adminPostedVideos: number;
  userGeneratedVideos: number;
  oldVideoCount: number;
  estimatedStorageGB: number;
}> => {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  try {
    const totalVideos = await GeneratedVideo.countDocuments();
    const adminPostedVideos = await GeneratedVideo.countDocuments({
      isAdminPosted: true,
    });
    const userGeneratedVideos = totalVideos - adminPostedVideos;
    const oldVideoCount = await GeneratedVideo.countDocuments({
      createdAt: { $lt: threeDaysAgo },
      isAdminPosted: { $ne: true },
    });

    // Rough estimate: 50MB average per video
    const estimatedStorageGB = (totalVideos * 50) / 1024;

    return {
      totalVideos,
      adminPostedVideos,
      userGeneratedVideos,
      oldVideoCount,
      estimatedStorageGB: Math.round(estimatedStorageGB * 100) / 100,
    };
  } catch (error) {
    console.error(
      `[storageCleanup] Failed to get storage summary: ${(error as Error).message}`,
    );
    return {
      totalVideos: 0,
      adminPostedVideos: 0,
      userGeneratedVideos: 0,
      oldVideoCount: 0,
      estimatedStorageGB: 0,
    };
  }
};
