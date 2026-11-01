import "dotenv/config";
import app from "./app.ts";
import connectDB from "./db/index.ts";
import { clearAllTempDirs } from "./utils/tempDir.ts";

const PORT = process.env.PORT || 9999;

const startServer = async () => {
  try {
    await clearAllTempDirs();
    await connectDB();
    await import("./workers/videoRender.worker.ts");

    app.listen(PORT, () => {
      console.log(`Server is up and running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Fatal: failed to start server", error);
    process.exit(1);
  }
};

startServer();
