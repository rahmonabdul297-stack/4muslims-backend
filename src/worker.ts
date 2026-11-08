import "dotenv/config";
import { clearAllTempDirs } from "./utils/tempDir.ts";
import connectDB from "./db/index.ts";
import { processNextJob } from "./jobs/job-queue.ts";

const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const startWorker = async () => {
  try {
    await clearAllTempDirs();
    await connectDB();
    console.log("Local queue worker started");

    while (true) {
      try {
        const result = await processNextJob();
        if (!result.processed) await delay(2000);
      } catch (error) {
        console.error("Local queue worker iteration failed:", error);
        await delay(2000);
      }
    }
  } catch (error) {
    console.error("Fatal: failed to start background worker", error);
    process.exit(1);
  }
};

startWorker();
