import dotenv from "dotenv";
dotenv.config();
import cloud, { type UploadApiResponse } from "cloudinary";
import type {
  CloudinaryUploadResponse,
  CloudinaryUploadResult,
  CloudinaryVideoUploadResult,
} from "./types/cloudinary.types.ts";
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
      { folder: folderName, resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error);
        resolve(result as CloudinaryUploadResponse);
      },
    );
    uploadStream.end(fileBuffer);
  });
};
export const uploadVideoToCloudinary = (
  filePath: string,
  folderName: string,
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_large(
      filePath,
      {
        folder: folderName,
        resource_type: "video", // Crucial: explicitly mark as video!
        chunk_size: 6000000, // Upload in 6MB chunks to prevent memory spikes
        overwrite: true,
      },
      (error, result) => {
        if (error || !result) return reject(error);
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
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder },
        (error, result) => {
          if (error || !result) return reject(error);
          resolve({
            url: result.secure_url,
            public_id: result.public_id,
          });
        },
      );
      uploadStream.end(file.buffer);
    });
  });

  return Promise.all(uploadPromises);
};

export const uploadMultipleVideosToCloudinary = async (
  files: Express.Multer.File[],
  folder: string,
): Promise<CloudinaryVideoUploadResult[]> => {
  const uploadPromises = files.map((file) => {
    return new Promise<CloudinaryVideoUploadResult>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "video",
          eager_async: true,
          chunk_size: 20000000,
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            return reject(error || new Error("Cloudinary video upload failed"));
          }
          resolve({
            url: result.secure_url,
            public_id: result.public_id,
            duration: result.duration, // Cloudinary provides video duration automatically
            format: result.format,
          });
        },
      );

      uploadStream.end(file.buffer);
    });
  });

  return Promise.all(uploadPromises);
};

const deleteImageFromCloudinary = async (public_id: string): Promise<any> => {
  return await cloudinary.uploader.destroy(public_id);
};
export {
  cloudinaryUploader,
  cloudinaryDestroyer,
  deleteImageFromCloudinary,
  uploadMultipleImagesToCloudinary,
};
