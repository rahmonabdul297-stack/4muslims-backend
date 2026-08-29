import "dotenv/config";
import dns from "dns";
import express from "express";
import Admin from "./routes/admin/admin-routes.ts";
import Public from "./routes/public/public-routes.ts";
import UserAuth from "./routes/user/user-auth-route.ts";
import UserProfile from "./routes/user/user-profile-route.ts";
import VideoRoutes from "./routes/video-routes.ts";
import paymentRoutes from "./routes/payment/payment-route.ts";
import connectDB from "./db/index.ts";

// Node's built-in resolver intermittently fails SRV/TXT lookups on some networks; pin to public DNS
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();
const PORT = 9999;

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});
app.use("/api/v1/admin", Admin);
app.use("/api/v1/public", Public);
app.use("/api/v1/auth", UserAuth);
app.use("/api/v1/profile", UserProfile);
app.use("/api/v1/videos", VideoRoutes);
app.use("/api/v1/payments", paymentRoutes);

// Start server only after database is ready
const startServer = async () => {
  try {
    await connectDB();

    // Import workers AFTER database is connected to prevent Agenda connection race
    await import("./workers/videoRender.worker.ts");
    await import("./workers/autopostcron.worker.ts");
    await import("./workers/storageCleanup.worker.ts");

    app.listen(PORT, () => {
      console.log(`Server is up and running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Fatal: failed to start server", error);
    process.exit(1);
  }
};

startServer();
