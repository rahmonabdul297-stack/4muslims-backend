import type { Request, Response } from "express";
import axios from "axios";
import { sendErrorResponse, sendSuccessResponse } from "../utils/helper.ts";
import { GeneratedVideo } from "../models/generatevideo.ts";
import { Video } from "../models/videotemp.ts";
import { videoRenderQueue } from "../queues/videorender.ts";
import {
  buildQuranAudioUrl,
  getGlobalAyahNumber,
  normalizeQuranAudioUrl,
} from "../services/audioUrl.service.ts";
import { findReciterConfig } from "../config/reciters.ts";

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
  bitrate?: string | number,
) => {
  return buildQuranAudioUrl(reciterId, surahNumber, ayahNumber, bitrate);
};

const fetchQuranAyah = async (surahNumber: number, ayahNumber: number) => {
  try {
    const resp = await axios.get(
      `https://api.alquran.cloud/v1/ayah/${surahNumber}:${ayahNumber}/quran-uthmani`,
    );
    const arabic = resp?.data?.data?.text || "";
    return { arabicText: arabic };
  } catch (err) {
    console.warn(
      "Failed to fetch ayah text from AlQuran API:",
      (err as Error).message,
    );
    return { arabicText: "" };
  }
};

const validateUrlAccessible = async (url: string) => {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    Accept: "*/*",
    Referer: "https://cdn.islamic.network/",
  };

  try {
    await axios.head(url, { headers });
    return true;
  } catch (error) {
    const axiosError = error as any;
    if (axiosError?.response?.status === 405) {
      const response = await axios.get(url, {
        responseType: "stream",
        headers,
      });
      response.data.destroy();
      return true;
    }
    throw new Error(
      `URL validation failed for ${url}: ${axiosError?.response?.status || "unknown"} ${axiosError?.response?.statusText || axiosError?.message}`,
    );
  }
};

const generateCustomVideo = async (req: Request, res: Response) => {
  const userId = (req as any).id;

  // Attached by enforcePlanLimits middleware
  const user = (req as any).userInstance;
  const planConfig = (req as any).planConfig;

  const {
    templateId,
    surahNumber,
    ayahNumber,
    reciterId,
    arabicText,
    translationText,
    surahName,
  } = req.body;

  if (
    !templateId ||
    typeof surahNumber !== "number" ||
    typeof ayahNumber !== "number" ||
    !reciterId
  ) {
    return sendErrorResponse(
      res,
      "templateId, surahNumber, ayahNumber and reciterId are required!",
      400,
    );
  }

  const reciterConfig = findReciterConfig(reciterId);
  if (!reciterConfig) {
    return sendErrorResponse(res, "Invalid reciterId provided", 400);
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
    const globalAyahNumber = getGlobalAyahNumber(surahNumber, ayahNumber);
    const videoUrl = await findTemplateVideo(templateId);
    const bitrate = reciterConfig.bitrate ?? process.env.QURAN_AUDIO_BITRATE;
    let audioUrl = await findAudioUrl(
      reciterId,
      surahNumber,
      ayahNumber,
      bitrate,
    );
    audioUrl = normalizeQuranAudioUrl(
      audioUrl,
      reciterId,
      surahNumber,
      ayahNumber,
      bitrate,
    );

    console.log("[generateCustomVideo] audioUrl=", audioUrl, {
      templateId,
      surahNumber,
      ayahNumber,
      reciterId,
      resolvedArabicText,
      resolvedTranslationText,
      bitrate: bitrate || "128",
      reciterName: reciterConfig.name,
    });

    await validateUrlAccessible(audioUrl);

    const generated = await GeneratedVideo.create({
      userId,
      templateId,
      surahNumber,
      ayahNumber,
      globalAyahNumber,
      reciterId,
      audioUrl,
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
      // Queue rendering job with plan settings passed through
      job = await videoRenderQueue.add("render-video", {
        mongoRenderId: generated._id.toString(),
        userId,
        templateId,
        videoUrl,
        audioUrl,
        arabicText: resolvedArabicText,
        translationText: resolvedTranslationText,
        surahNumber,
        ayahNumber,
        globalAyahNumber,
        surahName,
        reciterId,
        // Pass plan enforcement properties to the BullMQ worker / FFmpeg process
        planConfig: {
          hasWatermark: planConfig.hasWatermark,
          preset: planConfig.preset,
          crf: planConfig.crf,
          resolutionScale: planConfig.resolutionScale,
          audioBitrate: planConfig.audioBitrate,
          maxDurationSeconds: planConfig.maxDurationSeconds,
        },
      });

      console.log("[generateCustomVideo] queued audioUrl=", audioUrl, {
        rawReciterId: reciterId,
        normalizedReciterId: reciterId,
        ayahNumber,
        bitrate,
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

    // Save job ID and increment the user's manual generations count
    generated.jobId = job.id;
    await generated.save();

    user.monthlyUsage.manualGenerationsCount += 1;
    await user.save();

    return res.status(202).json({
      success: true,
      message: "Video rendering task queued successfully",
      data: {
        jobId: job.id,
        renderId: generated._id,
        status: "pending",
        usage: {
          used: user.monthlyUsage.manualGenerationsCount,
          limit: planConfig.manualLimit, // -1 means unlimited
        },
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
const generatedVideoHistory = async (req: Request, res: Response) => {
  const userId = (req as any).id;
  if (!userId) {
    return sendErrorResponse(res, "You're not authenticated!");
  }
  try {
    const history = await GeneratedVideo.find({
      userId: userId,
    });
    if (!history || history.length === 0) {
      return sendErrorResponse(res, "No Generated video found!");
    }
    return sendSuccessResponse(res, "history successfully fetched", history);
  } catch (error) {
    console.log((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};

export { generateCustomVideo, getVideoStatus, generatedVideoHistory };
