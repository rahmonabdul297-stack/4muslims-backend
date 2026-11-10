import { clearAllTempDirs } from "../utils/tempDir.ts";
import connectDB from "../db/index.ts";
import { processNextJob } from "./job-queue.ts";

const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export const startLocalWorker = async (signal?: AbortSignal): Promise<void> => {
  await clearAllTempDirs();
  await connectDB();
  console.log("Local queue worker started");

  while (!signal?.aborted) {
    try {
      const result = await processNextJob();
      if (!result.processed) await delay(2000);
    } catch (error) {
      console.error("Local queue worker iteration failed:", error);
      await delay(2000);
    }
  }

  console.log("Local queue worker stopped");
};
