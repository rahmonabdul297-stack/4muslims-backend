import type { Request, Response } from "express";
import { sendErrorResponse, sendSuccessResponse } from "../../utils/helper.ts";
import { uploadMultipleVideosToCloudinary } from "../../cloudinary.ts";
import { Video } from "../../models/videotemp.ts";
import { isValidObjectId } from "mongoose";

const postVideo = async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      category,
      durationSeconds,
      isPremium,
      resolution,
    } = req.body;

    if (!title || !description || !category || !durationSeconds) {
      return sendErrorResponse(
        res,
        "title, description, category, and durationSeconds are required!",
      );
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return sendErrorResponse(
        res,
        "At least one video file is required!",
        400,
      );
    }
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
    const videoDocsToCreate = uploadResults.map((video, index) => ({
      title: files.length > 1 ? `${title} (Part ${index + 1})` : title,
      description,
      category,
      durationSeconds: Number(video.duration || durationSeconds),
      isPremium: isPremium,
      resolution: resolution || "1080p",
      videoUrl: video.url,
      cloudinaryPublicId: video.public_id,
      thumbnailUrl: video.url.replace(/\.[^/.]+$/, ".jpg"),
    }));
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
    if(!isValidObjectId(id)){
        return sendErrorResponse(res,"Enter valid Id!")
    }
    const video = await Video.findByIdAndDelete(id)
    if(!video){
        return sendErrorResponse(res,"video doesn't exist!")
    }
   return sendSuccessResponse(res, "video successfully deleted!")
  } catch (error) {
    console.log((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};

export { postVideo, getVideos, deleteVideo };
