"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderQuranOverlay = exports.getAudioDuration = exports.shapeArabicText = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
const ffprobe_1 = __importDefault(require("@ffprobe-installer/ffprobe"));
const arabic_persian_reshaper_1 = __importDefault(require("arabic-persian-reshaper"));
const bidi_js_1 = __importDefault(require("bidi-js"));
const cloudinary_1 = require("cloudinary");
const ensureCloudinaryConfig = () => {
    const cloudName = process.env.CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUD_API_KEY?.trim();
    const apiSecret = process.env.CLOUD_API_SECRET?.trim();
    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error("Cloudinary config missing: CLOUD_NAME, CLOUD_API_KEY, and CLOUD_API_SECRET must be set.");
    }
    cloudinary_1.v2.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
        timeout: 300000, // 5 minutes timeout for Cloudinary operations
    });
};
ensureCloudinaryConfig();
fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_static_1.default);
fluent_ffmpeg_1.default.setFfprobePath(ffprobe_1.default.path);
const bidi = (0, bidi_js_1.default)();
const shapeArabicText = (text) => {
    if (!text)
        return "";
    const joinedText = arabic_persian_reshaper_1.default.ArabicShaper.convertArabic(text);
    const embeddingLevels = bidi.getEmbeddingLevels(joinedText);
    const reordered = bidi.getReorderedString(joinedText, embeddingLevels);
    return reordered.split("").reverse().join("");
};
exports.shapeArabicText = shapeArabicText;
const splitTextIntoChunks = (text, maxWordsPerChunk = 7) => {
    const words = text.trim().split(/\s+/);
    const chunks = [];
    for (let i = 0; i < words.length; i += maxWordsPerChunk) {
        chunks.push(words.slice(i, i + maxWordsPerChunk).join(" "));
    }
    return chunks;
};
const formatSrtTime = (seconds) => {
    const pad = (num, size = 2) => String(num).padStart(size, "0");
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${String(millis).padStart(3, "0")}`;
};
const generateInMemorySrt = (arabicText, translationText, totalDuration) => {
    const arabicChunks = splitTextIntoChunks(arabicText, 6);
    const translationChunks = splitTextIntoChunks(translationText, 8);
    const totalSegments = Math.max(arabicChunks.length, translationChunks.length);
    const segmentDuration = totalDuration / totalSegments;
    let srtContent = "";
    for (let i = 0; i < totalSegments; i++) {
        const startTime = i * segmentDuration;
        const endTime = (i + 1) * segmentDuration;
        const rawArabic = arabicChunks[i] || arabicChunks[arabicChunks.length - 1];
        const shapedArabic = (0, exports.shapeArabicText)(String(rawArabic));
        const translation = translationChunks[i] || translationChunks[translationChunks.length - 1];
        srtContent += `${i + 1}\n`;
        srtContent += `${formatSrtTime(startTime)} --> ${formatSrtTime(endTime)}\n`;
        // Arabic: Large (26px) & Bold (\b1)
        // Translation: Half-size (13px), Normal weight (\b0), Soft white color (\c&HE0E0E0&)
        srtContent += `{\\fs26\\b1}${shapedArabic}\n{\\fs13\\b0\\c&HE0E0E0&}${translation}{\\r}\n\n`;
    }
    return srtContent;
};
const getAudioDuration = (audioUrl) => {
    return new Promise((resolve, reject) => {
        fluent_ffmpeg_1.default.ffprobe(audioUrl, (err, metadata) => {
            if (err) {
                return reject(new Error(`Failed to probe audio duration: ${err.message}`));
            }
            const duration = metadata.format?.duration;
            if (!duration || isNaN(duration)) {
                return reject(new Error("Unable to determine audio track duration."));
            }
            resolve(duration);
        });
    });
};
exports.getAudioDuration = getAudioDuration;
const renderQuranOverlay = async ({ jobId, videoUrl, audioUrl, surahNumber, ayahNumber, arabicText, translationText, surahName, onProgress, }) => {
    const duration = await (0, exports.getAudioDuration)(audioUrl);
    const srtContent = generateInMemorySrt(arabicText, translationText, duration);
    const workDir = path_1.default.join(process.cwd(), "tmp", jobId);
    await fs_1.default.promises.mkdir(workDir, { recursive: true });
    const tempSrtPath = path_1.default.join(workDir, `sub_${Date.now()}.srt`);
    const tempVideoPath = path_1.default.join(workDir, `render_${Date.now()}.mp4`);
    await fs_1.default.promises.writeFile(tempSrtPath, srtContent, "utf8");
    const escapedSrtPath = tempSrtPath.replace(/\\/g, "/").replace(/:/g, "\\:");
    const cleanupTempFiles = async () => {
        try {
            await fs_1.default.promises.rm(workDir, { recursive: true, force: true });
        }
        catch {
            // Ignore directory cleanup errors
        }
    };
    try {
        // Step 1: Render video locally using FFmpeg with hard file size limits
        await new Promise((resolve, reject) => {
            let isFinished = false;
            const command = (0, fluent_ffmpeg_1.default)()
                .input(videoUrl)
                .inputOptions(["-stream_loop", "-1"])
                .input(audioUrl)
                .complexFilter([
                `[0:v]setpts=N/FRAME_RATE/TB[bg]`,
                // WrapStyle=2 allows clean responsive text wrapping across video widths
                // MarginL=50 & MarginR=50 prevent text from hitting side edges or clumping awkwardly
                `[bg]subtitles='${escapedSrtPath}':force_style='Fontsize=26,PrimaryColour=&H00FFFFFF&,OutlineColour=&H80000000&,BorderStyle=1,Outline=2,Alignment=2,MarginV=50,MarginL=50,MarginR=50,WrapStyle=2'[outv]`,
            ])
                .outputOptions([
                "-map",
                "[outv]",
                "-map",
                "1:a",
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-threads",
                "2",
                "-crf",
                "30", // Keeps file size significantly smaller
                "-maxrate",
                "3500k", // Caps peak video bitrate to 3.5 Mbps
                "-bufsize",
                "7000k",
                "-fs",
                "90M", // Forces FFmpeg to abort if output hits 90 MB
                "-c:a",
                "aac",
                "-b:a",
                "128k",
                "-pix_fmt",
                "yuv420p",
                "-shortest",
                "-max_muxing_queue_size",
                "1024",
            ])
                .output(tempVideoPath);
            const watchdogTimeout = setTimeout(() => {
                if (!isFinished) {
                    isFinished = true;
                    command.kill("SIGKILL");
                    reject(new Error("Render operation timed out after 5 minutes"));
                }
            }, 300000);
            let lastProgressTime = 0;
            if (onProgress) {
                command.on("progress", (progress) => {
                    const now = Date.now();
                    if (now - lastProgressTime > 1000) {
                        lastProgressTime = now;
                        let percent = 0;
                        if (progress.percent && !isNaN(progress.percent)) {
                            percent = Math.min(Math.round(progress.percent), 95);
                        }
                        else if (progress.timemark && duration > 0) {
                            const parts = progress.timemark.split(":");
                            if (parts.length === 3) {
                                const hours = parseFloat(parts[0] ?? "0") || 0;
                                const minutes = parseFloat(parts[1] ?? "0") || 0;
                                const seconds = parseFloat(parts[2] ?? "0") || 0;
                                const currentSecs = hours * 3600 + minutes * 60 + seconds;
                                percent = Math.min(Math.round((currentSecs / duration) * 95), 95);
                            }
                        }
                        if (percent > 0) {
                            try {
                                Promise.resolve(onProgress(percent)).catch((err) => console.error("Progress callback non-fatal error:", err));
                            }
                            catch (err) {
                                console.error("Sync progress callback error:", err);
                            }
                        }
                    }
                });
            }
            command.on("error", (err) => {
                if (isFinished)
                    return;
                isFinished = true;
                clearTimeout(watchdogTimeout);
                reject(new Error(`FFmpeg rendering failed: ${err.message}`));
            });
            command.on("end", () => {
                if (isFinished)
                    return;
                isFinished = true;
                clearTimeout(watchdogTimeout);
                console.log(`[FFmpeg]: Local render completed for job ${jobId}.`);
                resolve();
            });
            command.run();
        });
        // Step 2: Validate file size before uploading to Cloudinary
        const fileStats = await fs_1.default.promises.stat(tempVideoPath);
        const maxSizeBytes = 95 * 1024 * 1024; // 95 MB threshold
        if (fileStats.size > maxSizeBytes) {
            throw new Error(`Rendered video size (${(fileStats.size / (1024 * 1024)).toFixed(2)} MB) exceeds Cloudinary's maximum allowed limit of 95 MB.`);
        }
        // Step 3: Upload rendered file to Cloudinary in chunks
        if (onProgress) {
            await Promise.resolve(onProgress(98));
        }
        const uploadResult = await new Promise((resolve, reject) => {
            cloudinary_1.v2.uploader.upload_large(tempVideoPath, {
                resource_type: "video",
                folder: "quran_generated_videos",
                chunk_size: 6000000, // 6MB chunks to prevent HTTP 413
                overwrite: true,
                use_filename: true,
                unique_filename: false,
            }, (error, result) => {
                if (error)
                    return reject(error);
                resolve(result);
            });
        });
        if (!uploadResult?.secure_url) {
            throw new Error("Cloudinary upload failed: missing secure_url");
        }
        return uploadResult.secure_url;
    }
    finally {
        await cleanupTempFiles();
    }
};
exports.renderQuranOverlay = renderQuranOverlay;
//# sourceMappingURL=quranOverlay.service.js.map