import "dotenv/config";
import express from "express";
import Admin from "./routes/admin/admin-routes.ts";
import Public from "./routes/public/public-routes.ts";
import UserAuth from "./routes/user/user-auth-route.ts";
import UserProfile from "./routes/user/user-profile-route.ts";
import paymentRoutes from "./routes/payment/payment-route.ts";
import connectDB from "./db/index.ts";

const app = express();
const PORT = 5000;

// middleware

connectDB();
app.use(express.json());

// ... other routes
app.use("/api/v1/admin", Admin);
app.use("/api/v1", Public);
app.use("/api/v1/auth", UserAuth);
app.use("/api/v1/profile", UserProfile);
app.use("/api/v1/payments", paymentRoutes);

app.listen(PORT, () => {
  console.log(`Server is up and running on http://localhost:${PORT}`);
});
