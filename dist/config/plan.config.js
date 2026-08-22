"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_CONFIGS = void 0;
exports.PLAN_CONFIGS = {
    FREE: {
        maxDurationSeconds: 10,
        manualLimit: 3,
        autoPostLimit: 0,
        hasWatermark: true,
        preset: "ultrafast",
        crf: "34",
        resolutionScale: "scale=-2:480",
        audioBitrate: "64",
    },
    PRO: {
        maxDurationSeconds: 60,
        manualLimit: 15,
        autoPostLimit: 5,
        hasWatermark: false,
        preset: "faster",
        crf: "26",
        audioBitrate: "128",
    },
    ULTIMATE: {
        maxDurationSeconds: 120,
        manualLimit: -1, // Unlimited manual generations
        autoPostLimit: 30, // 1 post daily
        hasWatermark: false,
        preset: "medium",
        crf: "24",
        audioBitrate: "128",
    },
};
//# sourceMappingURL=plan.config.js.map