// src/queues/videorender.ts
import { Agenda } from "agenda";
import { MongoBackend } from "@agendajs/mongo-backend";
import type { VideoRenderJobData } from "../types/videoRenderJob.types.ts";

export const VIDEO_RENDER_JOB = "render-video";
export const AUTOPOST_JOB = "autopost-user";

export interface AutoPostJobData {
  userId: string;
}

const mongoURI = process.env.LIVE_MONGODB_URI;
if (!mongoURI) {
  throw new Error("LIVE_MONGODB_URI is not configured; Agenda cannot start.");
}

// Agenda persists jobs as documents in this Mongo collection instead of Redis
export const agenda = new Agenda({
  backend: new MongoBackend({
    address: mongoURI,
    collection: "videoRenderJobs",
  }),
  processEvery: "5 seconds",
  maxConcurrency: 1,
});

agenda.on("error", (error: Error) => {
  console.error("Agenda connection error:", error);
});

export type { VideoRenderJobData };
