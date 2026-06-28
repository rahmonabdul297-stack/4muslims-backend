import "dotenv/config";
import express from "express";
import UserAuth from "./routes/user/user-auth-route.ts";
import UserProfile from "./routes/user/user-profile-route.ts";
import connectDB from "./db/index.ts";

const app = express();
const PORT = 9000;

// middleware

connectDB();
app.use(express.json());
app.use("/api/v1", UserAuth);
app.use("/api/v1", UserProfile);
app.listen(PORT, () => {
  console.log(`Server is up and running on http://localhost:${PORT}`);
});
