"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRenderPayload = exports.getAudioDuration = void 0;
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
/**
 * Utility to retrieve audio duration in seconds using ffprobe
 */
const getAudioDuration = (audioUrl) => {
    return new Promise((resolve, reject) => {
        fluent_ffmpeg_1.default.ffprobe(audioUrl, (err, metadata) => {
            if (err) {
                return reject(new Error(`Failed to probe audio duration: ${err.message}`));
            }
            const duration = metadata.format.duration;
            if (!duration || isNaN(duration)) {
                return reject(new Error("Unable to determine audio track duration."));
            }
            resolve(duration);
        });
    });
};
exports.getAudioDuration = getAudioDuration;
/**
 * Validates text length and audio runtime before spawning FFmpeg
 */
const validateRenderPayload = async ({ arabicText, translationText, audioUrl, maxArabicChars = 1000, maxTranslationChars = 750, maxDurationSeconds = 120, // 2 minutes max length
 }) => {
    // 1. Character Length Checks
    if (arabicText.length > maxArabicChars) {
        throw new Error(`Arabic text is too long (${arabicText.length} chars). Maximum allowed is ${maxArabicChars} chars to prevent excessive video size.`);
    }
    if (translationText.length > maxTranslationChars) {
        throw new Error(`Translation text is too long (${translationText.length} chars). Maximum allowed is ${maxTranslationChars} chars to prevent excessive video size.`);
    }
    // 2. Audio Duration Check
    const duration = await (0, exports.getAudioDuration)(audioUrl);
    if (duration > maxDurationSeconds) {
        throw new Error(`Audio recitation duration is too long (${Math.round(duration)}s). Maximum allowed length is ${maxDurationSeconds}s (100MB limit).`);
    }
    return { valid: true, duration };
};
exports.validateRenderPayload = validateRenderPayload;
//# sourceMappingURL=validatevideopayload.js.map