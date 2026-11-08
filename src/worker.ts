import "dotenv/config";
import { clearAllTempDirs } from "./utils/tempDir.ts";

const startWorker = async () => {
  try {
    await clearAllTempDirs();
    await import("./workers/videoRender.worker.ts");
  } catch (error) {
    console.error("Fatal: failed to start background worker", error);
    process.exit(1);
  }
};

startWorker();
