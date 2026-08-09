import { model, Schema } from "mongoose";
import type { GenerateVideoTypes } from "../types/global-type.ts";

const GenerateVideoSchema = new Schema<GenerateVideoTypes>(
  {
    jobId: { type: String },
    userId: { type: String, required: true },
    templateId: { type: String, required: true },
    surahNumber: { type: Number, required: true },
    ayahNumber: { type: Number, required: true },
    reciterId: { type: String, required: true },
    arabicText: { type: String, required: true },
    translationText: { type: String, required: true },
    audioUrl: { type: String, required: false, default: "" },
    globalAyahNumber: { type: Number, required: false },
    surahName: { type: String, required: false },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    progress: { type: Number, default: 0 },
    outputUrl: { type: String, required: false, default: "" },
    errorMessage: { type: String, required: false, default: "" },
  },
  { timestamps: true },
);

export const GeneratedVideo = model<GenerateVideoTypes>(
  "GeneratedVideo",
  GenerateVideoSchema,
);
