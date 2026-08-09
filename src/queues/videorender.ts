// src/queues/videoRender.queue.ts
import { Queue } from "bullmq";
import { redisConnection } from "../redis.ts";
import type { VideoRenderJobData } from "../types/redis.types.ts";

// Payload interface sent into the queue

export const VIDEO_RENDER_QUEUE = "video-render-queue";

export const videoRenderQueue = new Queue<VideoRenderJobData>(
  VIDEO_RENDER_QUEUE,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 604800 },
    },
  },
);
