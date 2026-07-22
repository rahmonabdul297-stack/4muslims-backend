import cloud from "cloudinary";
import type {
  CloudinaryUploadResponse,
  CloudinaryUploadResult,
} from "./types/cloudinary.types.ts";
const cloudinary = cloud.v2;

const cloud_name = process.env.CLOUD_NAME;
const api_key = process.env.CLOUD_API_KEY;
const api_secret = process.env.CLOUD_API_SECRET;
if (!cloud_name || !api_key || !api_secret) {
  throw new Error("something is missing, check your cloudinary config!.");
}
cloudinary.config({
  cloud_name: cloud_name,
  api_key: api_key,
  api_secret: api_secret,
});

const cloudinaryUploader = (
  fileBuffer: Buffer,
  folderName: string,
): Promise<CloudinaryUploadResponse> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: folderName },
      (error, result) => {
        if (error) return reject(error);
        resolve(result as CloudinaryUploadResponse);
      },
    );
    uploadStream.end(fileBuffer);
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


 const deleteImageFromCloudinary = async (public_id: string): Promise<any> => {
  return await cloudinary.uploader.destroy(public_id);
};
export  {
  cloudinaryUploader,
  cloudinaryDestroyer,
  deleteImageFromCloudinary,
  uploadMultipleImagesToCloudinary,
};
