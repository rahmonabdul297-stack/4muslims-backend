"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// 1. Initialize environment variables FIRST before loading DB modules
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), ".env") });
const fs_1 = __importDefault(require("fs"));
const bullmq_1 = require("bullmq");
const videorender_ts_1 = require("../queues/videorender.ts");
const reciters_ts_1 = require("../config/reciters.ts");
const quranOverlay_service_ts_1 = require("../services/quranOverlay.service.ts");
const redis_ts_1 = require("../redis.ts");
const clearTempDir = async (jobId) => {
    const dir = path_1.default.join(process.cwd(), "tmp", jobId);
    if (fs_1.default.existsSync(dir)) {
        await fs_1.default.promises.rm(dir, { recursive: true, force: true });
    }
};
const initWorker = async () => {
    // 2. Dynamically import DB and Models AFTER dotenv has populated process.env
    const { default: connectDB } = await Promise.resolve().then(() => __importStar(require("../db/index.ts")));
    const { GeneratedVideo } = await Promise.resolve().then(() => __importStar(require("../models/generatevideo.ts")));
    await connectDB();
    const updateRenderStatus = async (mongoRenderId, data) => {
        await GeneratedVideo.findByIdAndUpdate(mongoRenderId, data, {
            returnDocument: "after",
        });
    };
    const worker = new bullmq_1.Worker(videorender_ts_1.VIDEO_RENDER_QUEUE, async (job) => {
        const payload = job.data;
        if (!payload.mongoRenderId) {
            throw new Error("Missing mongoRenderId in render job");
        }
        const jobId = job.id?.toString();
        if (!jobId) {
            throw new Error("Missing BullMQ job id");
        }
        const reciterConfig = (0, reciters_ts_1.findReciterConfig)(payload.reciterId);
        if (!reciterConfig) {
            throw new Error(`Invalid reciterId: ${payload.reciterId}`);
        }
        await updateRenderStatus(payload.mongoRenderId, {
            status: "processing",
            progress: 10,
            audioUrl: payload.audioUrl,
            globalAyahNumber: payload.globalAyahNumber,
        });
        console.log("[videoRender.worker] processing audioUrl=", payload.audioUrl, {
            jobId,
            mongoRenderId: payload.mongoRenderId,
            surahNumber: payload.surahNumber,
            ayahNumber: payload.ayahNumber,
            reciterId: payload.reciterId,
            reciterName: reciterConfig.name,
        });
        let lastReportedProgress = 10;
        let isUpdatingDb = false;
        try {
            const outputUrl = await (0, quranOverlay_service_ts_1.renderQuranOverlay)({
                jobId,
                videoUrl: payload.videoUrl,
                audioUrl: payload.audioUrl,
                surahNumber: payload.surahNumber,
                ayahNumber: payload.ayahNumber,
                arabicText: payload.arabicText,
                translationText: payload.translationText,
                surahName: payload.surahName,
                onProgress: async (progress) => {
                    await job.updateProgress(progress);
                    if (progress > lastReportedProgress && !isUpdatingDb) {
                        lastReportedProgress = progress;
                        isUpdatingDb = true;
                        updateRenderStatus(payload.mongoRenderId, { progress })
                            .catch((err) => console.error("Failed to update progress in DB:", err))
                            .finally(() => {
                            isUpdatingDb = false;
                        });
                    }
                },
            });
            await updateRenderStatus(payload.mongoRenderId, {
                status: "completed",
                progress: 100,
                outputUrl,
            });
            return { outputUrl };
        }
        catch (error) {
            throw error;
        }
        finally {
            await clearTempDir(jobId);
        }
    }, {
        connection: redis_ts_1.redisConnection,
        concurrency: 1,
        lockDuration: 300000,
        lockRenewTime: 15000,
        stalledInterval: 30000,
        maxStalledCount: 2,
    });
    worker.on("failed", async (job, err) => {
        console.error("Video render job failed:", job?.id, "payload:", job?.data, "error:", err);
        if (!job?.data?.mongoRenderId)
            return;
        await updateRenderStatus(job.data.mongoRenderId, {
            status: "failed",
            errorMessage: err?.message || "Render failed",
        });
    });
    worker.on("error", (error) => {
        console.error("Video render worker error:", error);
    });
    console.log("Video render worker started");
};
initWorker().catch((error) => {
    console.error("Failed to initialize video render worker:", error);
    process.exit(1);
});
//# sourceMappingURL=videoRender.worker.js.map