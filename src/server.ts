import "dotenv/config";
import app from "./app.ts";
import connectDB from "./db/index.ts";
import { startLocalWorker } from "./jobs/local-worker.ts";

const PORT = process.env.PORT || 9999;
const workerController = new AbortController();

const startServer = async () => {
  try {
    await connectDB();

    process.once("SIGINT", () => workerController.abort());
    process.once("SIGTERM", () => workerController.abort());

    app.listen(PORT, () => {
      console.log(`API server is up and running on port ${PORT}`);
      void startLocalWorker(workerController.signal).catch((error) => {
        console.error("Fatal: failed to start local queue worker", error);
      });
    });
  } catch (error) {
    console.error("Fatal: failed to start server", error);
    process.exit(1);
  }
};

startServer();
