import type { Request, Response } from "express";
import fs from "fs";
import { sendErrorResponse, sendSuccessResponse } from "../../utils/helper.ts";
import { uploadMultipleVideosToCloudinary } from "../../cloudinary.ts";
import { Video } from "../../models/videotemp.ts";
import { isValidObjectId } from "mongoose";

const postVideo = async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];

  try {
    const {
      title,
      description,
      category,
      durationSeconds,
      isPremium,
      resolution,
    } = req.body;

    // 1. Validate required text fields
    if (!title || !description || !category) {
      return sendErrorResponse(
        res,
        "title, description and category are required!",
        400,
      );
    }

    // 2. Validate uploaded files existence
    if (!files || files.length === 0) {
      return sendErrorResponse(
        res,
        "At least one video file is required!",
        400,
      );
    }

    // 3. Check individual file sizes (e.g., 100MB limit per file)
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB in bytes
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return sendErrorResponse(
          res,
          `File "${file.originalname}" is too large. Maximum allowed size is 100MB.`,
          400,
        );
      }
    }

    // 4. Upload videos to Cloudinary
    const uploadResults = await uploadMultipleVideosToCloudinary(
      files,
      "videos",
    );

    if (!uploadResults || uploadResults.length === 0) {
      return sendErrorResponse(
        res,
        "Failed to upload videos to Cloudinary",
        500,
      );
    }

    // 5. Prepare MongoDB documents
    const videoDocsToCreate = uploadResults.map((video, index) => ({
      title: files.length > 1 ? `${title} (Part ${index + 1})` : title,
      description,
      category,
      durationSeconds: Math.round(
        Number(video.duration || durationSeconds || 0),
      ),
      isPremium: isPremium === "true" || isPremium === true,
      resolution: resolution || "1080p",
      videoUrl: video.url,
      cloudinaryPublicId: video.public_id,
      thumbnailUrl: video.url.replace(/\.[^/.]+$/, ".jpg"),
    }));

    // 6. Save records to Database
    const createdVideos = await Video.insertMany(videoDocsToCreate);

    return sendSuccessResponse(
      res,
      `${createdVideos.length} video(s) uploaded successfully`,
      createdVideos,
      201,
    );
  } catch (error) {
    console.error("Video Upload Error:", (error as Error).message);
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500,
    );
  } finally {
    // 7. Safety Cleanup: Delete any temporary disk files left behind
    if (files && files.length > 0) {
      files.forEach((file) => {
        if (file.path && fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
          } catch (cleanupErr) {
            console.error(
              `Failed to delete temp file ${file.path}:`,
              cleanupErr,
            );
          }
        }
      });
    }
  }
};

const getVideos = async (req: Request, res: Response) => {
  try {
    const videos = await Video.find();
    if (!videos) {
      return sendErrorResponse(res, "no video found!");
    }
    return sendSuccessResponse(res, "here they are!", videos, videos.length);
  } catch (error) {
    console.log((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};

const deleteVideo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return sendErrorResponse(res, "Enter valid Id!");
    }
    const video = await Video.findByIdAndDelete(id);
    if (!video) {
      return sendErrorResponse(res, "video doesn't exist!");
    }
    return sendSuccessResponse(res, "video successfully deleted!");
  } catch (error) {
    console.log((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};

export { postVideo, getVideos, deleteVideo };
