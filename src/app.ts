import "dotenv/config";
import express from "express";
import Admin from "./routes/admin/admin-routes.ts";
import Public from "./routes/public/public-routes.ts";
import UserAuth from "./routes/user/user-auth-route.ts";
import UserProfile from "./routes/user/user-profile-route.ts";
import VideoRoutes from "./routes/video-routes.ts";
import paymentRoutes from "./routes/payment/payment-route.ts";
import connectDB from "./db/index.ts";

const app = express();
const PORT = 9999;

const startServer = async () => {
  await connectDB();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  // ... other routes
  app.use("/api/v1/admin", Admin);
  app.use("/api/v1/public", Public);
  app.use("/api/v1/auth", UserAuth);
  app.use("/api/v1/profile", UserProfile);
  app.use("/api/v1/videos", VideoRoutes);
  app.use("/api/v1/payments", paymentRoutes);

  app.listen(PORT, () => {
    console.log(`Server is up and running on http://localhost:${PORT}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
