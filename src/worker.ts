import "dotenv/config";
import { startLocalWorker } from "./jobs/local-worker.ts";

startLocalWorker().catch((error) => {
  console.error("Fatal: failed to start background worker", error);
  process.exitCode = 1;
});
