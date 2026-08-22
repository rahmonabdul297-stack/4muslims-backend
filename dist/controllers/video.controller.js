"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatedVideoHistory = exports.getVideoStatus = exports.generateCustomVideo = void 0;
const axios_1 = __importDefault(require("axios"));
const helper_ts_1 = require("../utils/helper.ts");
const generatevideo_ts_1 = require("../models/generatevideo.ts");
const videotemp_ts_1 = require("../models/videotemp.ts");
const videorender_ts_1 = require("../queues/videorender.ts");
const audioUrl_service_ts_1 = require("../services/audioUrl.service.ts");
const reciters_ts_1 = require("../config/reciters.ts");
const findTemplateVideo = async (templateId) => {
    const video = await videotemp_ts_1.Video.findById(templateId);
    if (!video) {
        throw new Error("Template video not found");
    }
    return video.videoUrl;
};
const findAudioUrl = async (reciterId, surahNumber, ayahNumber, bitrate) => {
    return (0, audioUrl_service_ts_1.buildQuranAudioUrl)(reciterId, surahNumber, ayahNumber, bitrate);
};
const fetchQuranAyah = async (surahNumber, ayahNumber) => {
    try {
        const resp = await axios_1.default.get(`https://api.alquran.cloud/v1/ayah/${surahNumber}:${ayahNumber}/quran-uthmani`);
        const arabic = resp?.data?.data?.text || "";
        return { arabicText: arabic };
    }
    catch (err) {
        console.warn("Failed to fetch ayah text from AlQuran API:", err.message);
        return { arabicText: "" };
    }
};
const validateUrlAccessible = async (url) => {
    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        Accept: "*/*",
        Referer: "https://cdn.islamic.network/",
    };
    try {
        await axios_1.default.head(url, { headers });
        return true;
    }
    catch (error) {
        const axiosError = error;
        if (axiosError?.response?.status === 405) {
            const response = await axios_1.default.get(url, {
                responseType: "stream",
                headers,
            });
            response.data.destroy();
            return true;
        }
        throw new Error(`URL validation failed for ${url}: ${axiosError?.response?.status || "unknown"} ${axiosError?.response?.statusText || axiosError?.message}`);
    }
};
const generateCustomVideo = async (req, res) => {
    const userId = req.id;
    // Attached by enforcePlanLimits middleware
    const user = req.userInstance;
    const planConfig = req.planConfig;
    const { templateId, surahNumber, ayahNumber, reciterId, arabicText, translationText, surahName, } = req.body;
    if (!templateId ||
        typeof surahNumber !== "number" ||
        typeof ayahNumber !== "number" ||
        !reciterId) {
        return (0, helper_ts_1.sendErrorResponse)(res, "templateId, surahNumber, ayahNumber and reciterId are required!", 400);
    }
    const reciterConfig = (0, reciters_ts_1.findReciterConfig)(reciterId);
    if (!reciterConfig) {
        return (0, helper_ts_1.sendErrorResponse)(res, "Invalid reciterId provided", 400);
    }
    // If arabicText or translationText not provided, attempt to fetch Arabic text from the AlQuran API
    let resolvedArabicText = arabicText;
    let resolvedTranslationText = translationText;
    if (!resolvedArabicText || !resolvedTranslationText) {
        const fetched = await fetchQuranAyah(surahNumber, ayahNumber);
        if (!resolvedArabicText)
            resolvedArabicText = fetched.arabicText;
    }
    if (!resolvedArabicText) {
        return (0, helper_ts_1.sendErrorResponse)(res, "arabicText (or fetched ayah text) is required", 400);
    }
    try {
        const globalAyahNumber = (0, audioUrl_service_ts_1.getGlobalAyahNumber)(surahNumber, ayahNumber);
        const videoUrl = await findTemplateVideo(templateId);
        const bitrate = reciterConfig.bitrate ?? process.env.QURAN_AUDIO_BITRATE;
        let audioUrl = await findAudioUrl(reciterId, surahNumber, ayahNumber, bitrate);
        audioUrl = (0, audioUrl_service_ts_1.normalizeQuranAudioUrl)(audioUrl, reciterId, surahNumber, ayahNumber, bitrate);
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
        const generated = await generatevideo_ts_1.GeneratedVideo.create({
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
            job = await videorender_ts_1.videoRenderQueue.add("render-video", {
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
        }
        catch (queueError) {
            await generatevideo_ts_1.GeneratedVideo.findByIdAndDelete(generated._id);
            console.error("Queue dispatch failed:", queueError.message);
            return (0, helper_ts_1.sendErrorResponse)(res, "Failed to queue rendering job. Please try again.", 500);
        }
        if (!job?.id) {
            await generatevideo_ts_1.GeneratedVideo.findByIdAndDelete(generated._id);
            return (0, helper_ts_1.sendErrorResponse)(res, "Failed to dispatch rendering job.", 500);
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
    }
    catch (error) {
        if (error instanceof Error) {
            console.error("generateCustomVideo error:", error.message);
        }
        if (error instanceof Error &&
            error.message.includes("Template video not found")) {
            return (0, helper_ts_1.sendErrorResponse)(res, error.message, 404);
        }
        return (0, helper_ts_1.sendErrorResponse)(res, error.message || "Internal server error", 500);
    }
};
exports.generateCustomVideo = generateCustomVideo;
const getVideoStatus = async (req, res) => {
    const { jobId } = req.params;
    if (!jobId) {
        return (0, helper_ts_1.sendErrorResponse)(res, "jobId parameter is required", 400);
    }
    const record = await generatevideo_ts_1.GeneratedVideo.findOne({ jobId });
    if (!record) {
        return (0, helper_ts_1.sendErrorResponse)(res, "Video render job not found", 404);
    }
    return res.status(200).json({
        status: record.status,
        progress: record.progress,
        outputUrl: record.outputUrl,
        errorMessage: record.errorMessage,
    });
};
exports.getVideoStatus = getVideoStatus;
const generatedVideoHistory = async (req, res) => {
    const userId = req.id;
    if (!userId) {
        return (0, helper_ts_1.sendErrorResponse)(res, "You're not authenticated!");
    }
    try {
        const history = await generatevideo_ts_1.GeneratedVideo.find({
            userId: userId,
        });
        if (!history || history.length === 0) {
            return (0, helper_ts_1.sendErrorResponse)(res, "No Generated video found!");
        }
        return (0, helper_ts_1.sendSuccessResponse)(res, "history successfully fetched", history);
    }
    catch (error) {
        console.log(error.message);
        return (0, helper_ts_1.sendErrorResponse)(res, error.message);
    }
};
exports.generatedVideoHistory = generatedVideoHistory;
//# sourceMappingURL=video.controller.js.map