"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoRenderQueue = exports.VIDEO_RENDER_QUEUE = void 0;
// src/queues/videoRender.queue.ts
const bullmq_1 = require("bullmq");
const redis_ts_1 = require("../redis.ts");
exports.VIDEO_RENDER_QUEUE = "video-render-queue";
exports.videoRenderQueue = new bullmq_1.Queue(exports.VIDEO_RENDER_QUEUE, {
    connection: redis_ts_1.redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 5000,
        },
        removeOnComplete: { age: 86400 }, // Keep completed jobs for 24 hrs
        removeOnFail: { age: 604800 }, // Keep failed jobs for 7 days
    },
});
//# sourceMappingURL=videorender.js.map