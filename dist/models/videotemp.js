"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Video = void 0;
const mongoose_1 = require("mongoose");
const videoSchema = new mongoose_1.Schema({
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
}, { timestamps: true });
exports.Video = (0, mongoose_1.model)("Video", videoSchema);
//# sourceMappingURL=videotemp.js.map