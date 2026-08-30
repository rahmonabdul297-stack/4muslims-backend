import dotenv from "dotenv";
dotenv.config();

import cloud, { type UploadApiResponse } from "cloudinary";
import fs from "fs";
import type {
  CloudinaryUploadResponse,
  CloudinaryUploadResult,
  CloudinaryVideoUploadResult,
} from "./types/cloudinary.types.ts";
import { toDownloadUrl } from "./utils/cloudinaryHelper.ts";

const cloudinary = cloud.v2;

const applyCloudinaryConfig = () => {
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
    timeout: 120000,
  });
};

applyCloudinaryConfig();

const cloudinaryUploader = (
  fileBuffer: Buffer,
  folderName: string,
  resourceType: "auto" | "image" | "video" = "auto",
): Promise<CloudinaryUploadResponse> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: folderName, resource_type: resourceType, timeout: 120000 },
      (error, result) => {
        if (error) {
          return reject(
            new Error(`Cloudinary upload_stream failed: ${error.message}`),
          );
        }
        if (!result) {
          return reject(
            new Error(
              "Cloudinary upload_stream returned no result object. Check Cloudinary credentials and network.",
            ),
          );
        }
        if (!result.secure_url) {
          return reject(
            new Error(
              `Cloudinary upload returned invalid result: ${JSON.stringify(result)}`,
            ),
          );
        }
        resolve(result as CloudinaryUploadResponse);
      },
    );
    uploadStream.on("error", (error) => {
      reject(new Error(`Upload stream error: ${error.message}`));
    });
    uploadStream.end(fileBuffer);
  });
};

/**
 * Upload a single image from a local disk path (Multer diskStorage) — never
 * buffers the file in Node memory, Cloudinary's SDK streams it from disk.
 */
export const uploadImageFromPath = (
  filePath: string,
  folderName: string,
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    if (!filePath || !fs.existsSync(filePath)) {
      return reject(new Error(`Image file not found at path: ${filePath}`));
    }

    cloudinary.uploader.upload(
      filePath,
      { folder: folderName, resource_type: "image", timeout: 120000 },
      (error, result) => {
        if (error) {
          return reject(new Error(`Image upload failed: ${error.message}`));
        }
        if (!result || !result.secure_url) {
          return reject(
            new Error("Cloudinary returned an invalid result for image upload"),
          );
        }
        resolve(result);
      },
    );
  });
};

export const uploadVideoToCloudinary = (
  filePath: string,
  folderName: string,
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    if (!filePath || !fs.existsSync(filePath)) {
      return reject(
        new Error(
          `Video file not found at path: ${filePath}. Ensure file exists before upload.`,
        ),
      );
    }

    cloudinary.uploader.upload_large(
      filePath,
      {
        folder: folderName,
        resource_type: "video",
        chunk_size: 6000000, // 6MB chunks
        overwrite: true,
        timeout: 600000, // 10 minutes for large video uploads
      },
      (error, result) => {
        if (error) {
          return reject(
            new Error(
              `Cloudinary video upload failed: ${error.message}. File: ${filePath}`,
            ),
          );
        }
        if (!result) {
          return reject(
            new Error(
              `Cloudinary upload_large returned null/undefined result for file: ${filePath}`,
            ),
          );
        }
        if (!result.secure_url) {
          return reject(
            new Error(
              `Cloudinary upload missing secure_url in result: ${JSON.stringify(result)}`,
            ),
          );
        }
        resolve(result);
      },
    );
  });
};

const cloudinaryDestroyer = (publicId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
};

const uploadMultipleImagesToCloudinary = async (
  files: Express.Multer.File[],
  folder: string,
): Promise<CloudinaryUploadResult[]> => {
  const uploadPromises = files.map((file) => {
    return new Promise<CloudinaryUploadResult>((resolve, reject) => {
      if (!file.buffer) {
        return reject(
          new Error(
            `File buffer missing for file: ${file.originalname}. Ensure Multer uses memoryStorage.`,
          ),
        );
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, timeout: 120000 },
        (error, result) => {
          if (error) {
            return reject(
              new Error(
                `Image upload failed for ${file.originalname}: ${error.message}`,
              ),
            );
          }
          if (!result) {
            return reject(
              new Error(
                `Cloudinary returned no result for image: ${file.originalname}`,
              ),
            );
          }
          if (!result.secure_url || !result.public_id) {
            return reject(
              new Error(
                `Invalid Cloudinary response for ${file.originalname}: ${JSON.stringify(result)}`,
              ),
            );
          }
          resolve({
            url: toDownloadUrl(result.secure_url),
            public_id: result.public_id,
          });
        },
      );
      uploadStream.on("error", (error) => {
        reject(
          new Error(
            `Upload stream error for ${file.originalname}: ${error.message}`,
          ),
        );
      });
      uploadStream.end(file.buffer);
    });
  });

  return Promise.all(uploadPromises);
};

export const uploadMultipleVideosToCloudinary = async (
  files: Express.Multer.File[],
  folder: string,
): Promise<CloudinaryVideoUploadResult[]> => {
  const results: CloudinaryVideoUploadResult[] = [];

  for (const file of files) {
    const filePath = file.path;

    if (!filePath) {
      throw new Error(
        `Video file path is undefined for ${file.originalname}. Ensure Multer diskStorage is configured.`,
      );
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(
        `Video file not found at ${filePath}. Multer may not have saved the file correctly.`,
      );
    }

    let uploadResult: UploadApiResponse | null = null;
    try {
      uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
        cloudinary.uploader.upload_large(
          filePath,
          {
            folder,
            resource_type: "video",
            chunk_size: 6 * 1024 * 1024,
            eager_async: true,
            timeout: 600000, // 10 minutes
          },
          (error, result) => {
            if (error) {
              return reject(
                new Error(
                  `Video upload to Cloudinary failed (${file.originalname}): ${error.message}`,
                ),
              );
            }
            if (!result) {
              return reject(
                new Error(
                  `Cloudinary returned null result for video: ${file.originalname}`,
                ),
              );
            }
            if (!result.secure_url || !result.public_id) {
              return reject(
                new Error(
                  `Cloudinary response incomplete for ${file.originalname}: ${JSON.stringify(result)}`,
                ),
              );
            }
            resolve(result);
          },
        );
      });

      results.push({
        url: toDownloadUrl(uploadResult.secure_url),
        public_id: uploadResult.public_id,
        duration: uploadResult.duration,
        format: uploadResult.format,
      });
    } catch (uploadError) {
      // Continue with other files but track the error
      console.error(
        `Error uploading ${file.originalname}:`,
        (uploadError as Error).message,
      );
      throw uploadError; // Re-throw to propagate to caller
    } finally {
      // Always clean up temp file
      try {
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`[Cleanup] Removed temp file: ${filePath}`);
        }
      } catch (cleanupError) {
        console.warn(
          `Failed to clean up temp file ${filePath}:`,
          (cleanupError as Error).message,
        );
        // Don't throw - cleanup failures shouldn't fail the whole operation
      }
    }
  }

  return results;
};

const deleteImageFromCloudinary = async (public_id: string): Promise<any> => {
  try {
    const result = await cloudinary.uploader.destroy(public_id);
    if (result.result === "not found") {
      console.warn(`Image not found in Cloudinary: ${public_id}`);
    }
    return result;
  } catch (error) {
    throw new Error(
      `Failed to delete image ${public_id}: ${(error as Error).message}`,
    );
  }
};

export {
  cloudinaryUploader,
  cloudinaryDestroyer,
  deleteImageFromCloudinary,
  uploadMultipleImagesToCloudinary,
};
