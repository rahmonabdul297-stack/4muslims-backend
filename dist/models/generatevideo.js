"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeneratedVideo = void 0;
const mongoose_1 = require("mongoose");
const GenerateVideoSchema = new mongoose_1.Schema({
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
}, { timestamps: true });
exports.GeneratedVideo = (0, mongoose_1.model)("GeneratedVideo", GenerateVideoSchema);
//# sourceMappingURL=generatevideo.js.map