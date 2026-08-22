"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVideoFromAudio = void 0;
const cloudinary_1 = require("cloudinary");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const cloud_name = process.env.CLOUD_NAME;
const api_key = process.env.CLOUD_API_KEY;
const api_secret = process.env.CLOUD_API_SECRET;
if (!cloud_name || !api_key || !api_secret) {
    throw new Error("Missing Cloudinary err.");
}
cloudinary_1.v2.config({
    cloud_name: cloud_name,
    api_key: api_key,
    api_secret: api_secret,
});
const generateVideoFromAudio = async (params) => {
    const { audioUrl, surahName, ayahNumber, translation } = params;
    const cloudName = process.env.CLOUD_NAME;
    if (!cloudName) {
        throw new Error("CLOUD_NAME is missing in environment variables.");
    }
    const cleanSurah = surahName.replace(/[^a-zA-Z0-9\s]/g, "");
    const shortTranslation = translation.length > 120 ? `${translation.slice(0, 117)}...` : translation;
    // Your uploaded Cloudinary background MP4 public_id
    const baseBackgroundPublicId = "quran_template_bg";
    const videoUrl = cloudinary_1.v2.url(baseBackgroundPublicId, {
        resource_type: "video",
        format: "mp4",
        transformation: [
            {
                overlay: `audio:${encodeURIComponent(audioUrl).replace(/\//g, "%3A")}`,
                flags: "layer_apply",
            },
            {
                color: "#FFFFFF",
                overlay: {
                    font_family: "Arial",
                    font_size: 42,
                    font_weight: "bold",
                    text: `Surah ${cleanSurah} [${ayahNumber}]`,
                },
                gravity: "north",
                y: 180,
            },
            {
                color: "#F0F0F0",
                overlay: {
                    font_family: "Arial",
                    font_size: 32,
                    text: shortTranslation,
                },
                gravity: "center",
                width: 850,
                crop: "fit",
            },
        ],
    });
    return videoUrl;
};
exports.generateVideoFromAudio = generateVideoFromAudio;
//# sourceMappingURL=video.service.js.map