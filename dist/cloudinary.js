"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMultipleImagesToCloudinary = exports.deleteImageFromCloudinary = exports.cloudinaryDestroyer = exports.cloudinaryUploader = exports.uploadMultipleVideosToCloudinary = exports.uploadVideoToCloudinary = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const cloudinary_1 = __importDefault(require("cloudinary"));
const fs_1 = __importDefault(require("fs"));
const cloudinary = cloudinary_1.default.v2;
const applyCloudinaryConfig = () => {
    const cloudName = process.env.CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUD_API_KEY?.trim();
    const apiSecret = process.env.CLOUD_API_SECRET?.trim();
    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error("Cloudinary config missing: CLOUD_NAME, CLOUD_API_KEY, and CLOUD_API_SECRET must be set.");
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
const cloudinaryUploader = (fileBuffer, folderName, resourceType = "auto") => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({ folder: folderName, resource_type: resourceType }, (error, result) => {
            if (error)
                return reject(error);
            resolve(result);
        });
        uploadStream.end(fileBuffer);
    });
};
exports.cloudinaryUploader = cloudinaryUploader;
const uploadVideoToCloudinary = (filePath, folderName) => {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_large(filePath, {
            folder: folderName,
            resource_type: "video", // Crucial: explicitly mark as video!
            chunk_size: 6000000, // Upload in 6MB chunks to prevent memory spikes
            overwrite: true,
        }, (error, result) => {
            if (error || !result)
                return reject(error);
            resolve(result);
        });
    });
};
exports.uploadVideoToCloudinary = uploadVideoToCloudinary;
const cloudinaryDestroyer = (publicId) => {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.destroy(publicId, (error, result) => {
            if (error)
                return reject(error);
            resolve(result);
        });
    });
};
exports.cloudinaryDestroyer = cloudinaryDestroyer;
const uploadMultipleImagesToCloudinary = async (files, folder) => {
    const uploadPromises = files.map((file) => {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
                if (error || !result)
                    return reject(error);
                resolve({
                    url: result.secure_url,
                    public_id: result.public_id,
                });
            });
            uploadStream.end(file.buffer);
        });
    });
    return Promise.all(uploadPromises);
};
exports.uploadMultipleImagesToCloudinary = uploadMultipleImagesToCloudinary;
const uploadMultipleVideosToCloudinary = async (files, folder) => {
    const results = [];
    for (const file of files) {
        // Fallback/Validation check to prevent "path argument must be string" error
        const filePath = file.path;
        if (!filePath) {
            throw new Error("File path is undefined. Make sure Multer is configured with diskStorage instead of memoryStorage.");
        }
        try {
            const uploadResult = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_large(filePath, {
                    folder,
                    resource_type: "video",
                    chunk_size: 6 * 1024 * 1024, // 6 MB chunks
                    eager_async: true,
                }, (error, result) => {
                    if (error || !result) {
                        return reject(error || new Error("Cloudinary video upload failed"));
                    }
                    resolve(result);
                });
            });
            results.push({
                url: uploadResult.secure_url,
                public_id: uploadResult.public_id,
                duration: uploadResult.duration,
                format: uploadResult.format,
            });
        }
        finally {
            // Safely delete temporary file after upload
            if (filePath && fs_1.default.existsSync(filePath)) {
                fs_1.default.unlinkSync(filePath);
            }
        }
    }
    return results;
};
exports.uploadMultipleVideosToCloudinary = uploadMultipleVideosToCloudinary;
const deleteImageFromCloudinary = async (public_id) => {
    return await cloudinary.uploader.destroy(public_id);
};
exports.deleteImageFromCloudinary = deleteImageFromCloudinary;
//# sourceMappingURL=cloudinary.js.map