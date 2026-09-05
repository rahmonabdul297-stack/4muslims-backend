import "dotenv/config";
import dns from "dns";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import Admin from "./routes/admin/admin-routes.ts";
import Public from "./routes/public/public-routes.ts";
import UserAuth from "./routes/user/user-auth-route.ts";
import UserProfile from "./routes/user/user-profile-route.ts";
import VideoRoutes from "./routes/video-routes.ts";
import paymentRoutes from "./routes/payment/payment-route.ts";
import connectDB from "./db/index.ts";
import { clearAllTempDirs } from "./utils/tempDir.ts";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();
const PORT = process.env.PORT || 9999;

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false); // 👈 Fix 3
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

// 1. Mount CORS at top level (Handles both standard requests and preflights)
app.use(cors(corsOptions)); // 👈 Fix 1

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser()); // 👈 Fix 2

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

app.use("/api/v1/admin", Admin);
app.use("/api/v1/public", Public);
app.use("/api/v1/auth", UserAuth);
app.use("/api/v1/profile", UserProfile);
app.use("/api/v1/videos", VideoRoutes);
app.use("/api/v1/payments", paymentRoutes);

const startServer = async () => {
  try {
    await clearAllTempDirs();
    await connectDB();

    await import("./workers/videoRender.worker.ts");
    await import("./workers/autopostcron.worker.ts");
    await import("./workers/storageCleanup.worker.ts");

    app.listen(PORT, () => {
      console.log(`Server is up and running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Fatal: failed to start server", error);
    process.exit(1);
  }
};

startServer();