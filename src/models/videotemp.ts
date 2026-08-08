import { model, Schema } from "mongoose";
import type { VideoTemplateTypes } from "../types/global-type.ts";

const videoSchema = new Schema<VideoTemplateTypes>(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ["nature", "abstract", "mosque"],
      required: true,
    },
    isPremium: {
      type: Boolean,
      required: true,
    },
    cloudinaryPublicId: {
      type: String,
      required: true,
    },
    videoUrl: {
      type: String,
      required: true,
    },
    thumbnailUrl: {
      type: String,
    },
    resolution: {
      type: String,
      default: "1080p",
    },
    durationSeconds: {
      type: Number,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export const Video = model<VideoTemplateTypes>("Video", videoSchema);
