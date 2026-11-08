import "dotenv/config";
import app from "./app.ts";
import connectDB from "./db/index.ts";

const PORT = process.env.PORT || 9999;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`API server is up and running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Fatal: failed to start server", error);
    process.exit(1);
  }
};

startServer();
