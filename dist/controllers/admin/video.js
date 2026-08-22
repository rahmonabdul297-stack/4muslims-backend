"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteVideo = exports.getVideos = exports.postVideo = void 0;
const fs_1 = __importDefault(require("fs"));
const helper_ts_1 = require("../../utils/helper.ts");
const cloudinary_ts_1 = require("../../cloudinary.ts");
const videotemp_ts_1 = require("../../models/videotemp.ts");
const mongoose_1 = require("mongoose");
const postVideo = async (req, res) => {
    const files = req.files;
    try {
        const { title, description, category, durationSeconds, isPremium, resolution, } = req.body;
        // 1. Validate required text fields
        if (!title || !description || !category) {
            return (0, helper_ts_1.sendErrorResponse)(res, "title, description and category are required!", 400);
        }
        // 2. Validate uploaded files existence
        if (!files || files.length === 0) {
            return (0, helper_ts_1.sendErrorResponse)(res, "At least one video file is required!", 400);
        }
        // 3. Check individual file sizes (e.g., 100MB limit per file)
        const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB in bytes
        for (const file of files) {
            if (file.size > MAX_FILE_SIZE) {
                return (0, helper_ts_1.sendErrorResponse)(res, `File "${file.originalname}" is too large. Maximum allowed size is 100MB.`, 400);
            }
        }
        // 4. Upload videos to Cloudinary
        const uploadResults = await (0, cloudinary_ts_1.uploadMultipleVideosToCloudinary)(files, "videos");
        if (!uploadResults || uploadResults.length === 0) {
            return (0, helper_ts_1.sendErrorResponse)(res, "Failed to upload videos to Cloudinary", 500);
        }
        // 5. Prepare MongoDB documents
        const videoDocsToCreate = uploadResults.map((video, index) => ({
            title: files.length > 1 ? `${title} (Part ${index + 1})` : title,
            description,
            category,
            durationSeconds: Math.round(Number(video.duration || durationSeconds || 0)),
            isPremium: isPremium === "true" || isPremium === true,
            resolution: resolution || "1080p",
            videoUrl: video.url,
            cloudinaryPublicId: video.public_id,
            thumbnailUrl: video.url.replace(/\.[^/.]+$/, ".jpg"),
        }));
        // 6. Save records to Database
        const createdVideos = await videotemp_ts_1.Video.insertMany(videoDocsToCreate);
        return (0, helper_ts_1.sendSuccessResponse)(res, `${createdVideos.length} video(s) uploaded successfully`, createdVideos, 201);
    }
    catch (error) {
        console.error("Video Upload Error:", error.message);
        return (0, helper_ts_1.sendErrorResponse)(res, error.message || "Internal server error", 500);
    }
    finally {
        // 7. Safety Cleanup: Delete any temporary disk files left behind
        if (files && files.length > 0) {
            files.forEach((file) => {
                if (file.path && fs_1.default.existsSync(file.path)) {
                    try {
                        fs_1.default.unlinkSync(file.path);
                    }
                    catch (cleanupErr) {
                        console.error(`Failed to delete temp file ${file.path}:`, cleanupErr);
                    }
                }
            });
        }
    }
};
exports.postVideo = postVideo;
const getVideos = async (req, res) => {
    try {
        const videos = await videotemp_ts_1.Video.find();
        if (!videos) {
            return (0, helper_ts_1.sendErrorResponse)(res, "no video found!");
        }
        return (0, helper_ts_1.sendSuccessResponse)(res, "here they are!", videos, videos.length);
    }
    catch (error) {
        console.log(error.message);
        return (0, helper_ts_1.sendErrorResponse)(res, error.message);
    }
};
exports.getVideos = getVideos;
const deleteVideo = async (req, res) => {
    try {
        const { id } = req.params;
        if (!(0, mongoose_1.isValidObjectId)(id)) {
            return (0, helper_ts_1.sendErrorResponse)(res, "Enter valid Id!");
        }
        const video = await videotemp_ts_1.Video.findByIdAndDelete(id);
        if (!video) {
            return (0, helper_ts_1.sendErrorResponse)(res, "video doesn't exist!");
        }
        return (0, helper_ts_1.sendSuccessResponse)(res, "video successfully deleted!");
    }
    catch (error) {
        console.log(error.message);
        return (0, helper_ts_1.sendErrorResponse)(res, error.message);
    }
};
exports.deleteVideo = deleteVideo;
//# sourceMappingURL=video.js.map