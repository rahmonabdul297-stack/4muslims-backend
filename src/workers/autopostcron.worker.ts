import cron from "node-cron";
import { triggerQuranAutoPost } from "../controllers/autoposter.controller.ts";
import { User } from "../models/User.ts";

// Runs every day at 09:00 AM UTC
cron.schedule("0 9 * * *", async () => {
  console.log("Running automated daily Quran video posts...");

  const users = await User.find({
    "autoPostSettings.enabled": true,
    subscriptionStatus: "active",
  });

  for (const user of users) {
    const fakeReq = { id: user._id } as any;
    const fakeRes = {
      status: () => fakeRes,
      json: (data: any) => console.log(`User ${user._id} post status:`, data),
    } as any;

    await triggerQuranAutoPost(fakeReq, fakeRes);
  }
});
