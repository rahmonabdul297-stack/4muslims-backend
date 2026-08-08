import type { Request, Response } from "express";
import axios from "axios";
import { sendErrorResponse, sendSuccessResponse } from "../utils/helper.ts";
import { GeneratedVideo } from "../models/generatevideo.ts";
import { Video } from "../models/videotemp.ts";
import { videoRenderQueue } from "../queues/videorender.ts";

const findTemplateVideo = async (templateId: string) => {
  const video = await Video.findById(templateId);
  if (!video) {
    throw new Error("Template video not found");
  }
  return video.videoUrl;
};

const findAudioUrl = async (
  reciterId: string,
  surahNumber: number,
  ayahNumber: number,
  bitrate?: string,
) => {
  // Use explicit CDN template if provided, otherwise fall back to env base
  const configuredBitrate = bitrate || process.env.QURAN_AUDIO_BITRATE || "64kbps";
  // Preferred template per request: https://cdn.islamic.network/quran/audio/${bitrate}/${reciterId}/${ayahNumber}.mp3
  // Build using the known CDN template to ensure consistent audio URLs
  return `https://cdn.islamic.network/quran/audio/${configuredBitrate}/${reciterId}/${ayahNumber}.mp3`;
};

const fetchQuranAyah = async (
  surahNumber: number,
  ayahNumber: number,
) => {
  try {
    const resp = await axios.get(
      `https://api.alquran.cloud/v1/ayah/${surahNumber}:${ayahNumber}/quran-uthmani`,
    );
    const arabic = resp?.data?.data?.text || "";
    return { arabicText: arabic };
  } catch (err) {
    console.warn("Failed to fetch ayah text from AlQuran API:", (err as Error).message);
    return { arabicText: "" };
  }
};

const generateCustomVideo = async (req: Request, res: Response) => {
  const userId = (req as any).id;
  const {
    templateId,
    surahNumber,
    ayahNumber,
    reciterId,
    arabicText,
    translationText,
    surahName,
  } = req.body;

  if (!templateId || typeof surahNumber !== "number" || typeof ayahNumber !== "number" || !reciterId) {
    return sendErrorResponse(
      res,
      "templateId, surahNumber, ayahNumber and reciterId are required!",
      400,
    );
  }

  // If arabicText or translationText not provided, attempt to fetch Arabic text from the AlQuran API
  let resolvedArabicText = arabicText;
  let resolvedTranslationText = translationText;
  if (!resolvedArabicText || !resolvedTranslationText) {
    const fetched = await fetchQuranAyah(surahNumber, ayahNumber);
    if (!resolvedArabicText) resolvedArabicText = fetched.arabicText;
  }

  if (!resolvedArabicText) {
    return sendErrorResponse(
      res,
      "arabicText (or fetched ayah text) is required",
      400,
    );
  }
  try {
    const videoUrl = await findTemplateVideo(templateId);
    const audioUrl = await findAudioUrl(reciterId, surahNumber, ayahNumber, process.env.QURAN_AUDIO_BITRATE);

    const generated = await GeneratedVideo.create({
      userId,
      templateId,
      surahNumber,
      ayahNumber,
      reciterId,
      arabicText: resolvedArabicText,
      translationText: resolvedTranslationText,
      surahName,
      status: "pending",
      progress: 0,
      outputUrl: "",
      errorMessage: "",
    });

    let job;
    try {
      job = await videoRenderQueue.add("render-video", {
        mongoRenderId: generated._id.toString(),
        userId,
        templateId,
        videoUrl,
        audioUrl,
        arabicText,
        translationText,
        surahNumber,
        ayahNumber,
        surahName,
        reciterId,
      });
    } catch (queueError) {
      await GeneratedVideo.findByIdAndDelete(generated._id);
      console.error("Queue dispatch failed:", (queueError as Error).message);
      return sendErrorResponse(
        res,
        "Failed to queue rendering job. Please try again.",
        500,
      );
    }

    if (!job?.id) {
      await GeneratedVideo.findByIdAndDelete(generated._id);
      return sendErrorResponse(res, "Failed to dispatch rendering job.", 500);
    }

    generated.jobId = job.id;
    await generated.save();

    return res.status(202).json({
      success: true,
      message: "Video rendering task queued successfully",
      data: {
        jobId: job.id,
        renderId: generated._id,
        status: "pending",
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error("generateCustomVideo error:", error.message);
    }
    if (
      error instanceof Error &&
      error.message.includes("Template video not found")
    ) {
      return sendErrorResponse(res, error.message, 404);
    }
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500,
    );
  }
};

const getVideoStatus = async (req: Request, res: Response) => {
  const { jobId } = req.params;
  if (!jobId) {
    return sendErrorResponse(res, "jobId parameter is required", 400);
  }

  const record = await GeneratedVideo.findOne({ jobId });
  if (!record) {
    return sendErrorResponse(res, "Video render job not found", 404);
  }

  return res.status(200).json({
    status: record.status,
    progress: record.progress,
    outputUrl: record.outputUrl,
    errorMessage: record.errorMessage,
  });
};

export { generateCustomVideo, getVideoStatus };
