import { v2 as cloudinary } from "cloudinary";

/**
 * Convert a Cloudinary URL to a download URL
 * Appends `fl_attachment` flag to force browser download instead of inline playback
 * @param url - Cloudinary media URL
 * @returns Download URL with attachment flag
 */
export const toDownloadUrl = (url: string): string => {
  if (!url) return url;

  // If URL already has attachment flag, return as-is
  if (url.includes("fl_attachment")) {
    return url;
  }

  // Insert attachment flag into transformation chain
  // Pattern: /upload/v{version}/{transformations}/file.ext
  // Target: /upload/{transformations},fl_attachment/file.ext
  const uploadIndex = url.indexOf("/upload/");
  if (uploadIndex === -1) {
    // Not a Cloudinary URL, return as-is
    return url;
  }

  const afterUpload = uploadIndex + "/upload/".length;
  const nextSlash = url.indexOf("/", afterUpload);

  if (nextSlash === -1) {
    // No version/transformation, append directly
    return `${url.substring(0, afterUpload)}fl_attachment/${url.substring(afterUpload)}`;
  }

  // Insert before the resource path
  return `${url.substring(0, nextSlash)},fl_attachment${url.substring(nextSlash)}`;
};

/**
 * Generate a signed download URL using Cloudinary's download method
 * @param publicId - Cloudinary public ID
 * @param resourceType - 'video', 'image', 'auto', etc.
 * @returns Signed download URL
 */
export const getSignedDownloadUrl = (
  publicId: string,
  resourceType: string = "video",
): string => {
  if (!publicId) {
    throw new Error("Public ID is required");
  }

  try {
    return cloudinary.url(publicId, {
      resource_type: resourceType,
      secure: true,
      flags: "attachment", // Force download behavior
      version: Math.floor(Date.now() / 1000), // Cache-busting
    });
  } catch (error) {
    console.error("Error generating signed download URL:", error);
    throw error;
  }
};

/**
 * Generate a direct file download link with security
 * @param publicId - Cloudinary public ID
 * @param filename - Optional filename for the download
 * @returns Download URL
 */
export const generateDownloadLink = (
  publicId: string,
  filename?: string,
): string => {
  const cloudName = process.env.CLOUD_NAME;
  if (!cloudName) {
    throw new Error("CLOUD_NAME is not configured");
  }

  // Base download URL using Cloudinary's direct download format
  const baseUrl = `https://res.cloudinary.com/${cloudName}/image/fetch/fl_attachment`;

  if (filename) {
    return `${baseUrl}?fl_attachment:${filename}/${publicId}`;
  }

  return `${baseUrl}/${publicId}`;
};
