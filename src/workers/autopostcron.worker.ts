import cron from "node-cron";
import { triggerQuranAutoPost } from "../controllers/autoposter.controller.ts";
import { User } from "../models/User.ts";

// Runs every day at 2:00 PM Nigerian time (WAT, UTC+1, no DST)
cron.schedule(
  "0 14 * * *",
  async () => {
    console.log("Running automated daily Quran auto-post job...");

    const users = await User.find({
      "autoPostSettings.enabled": true,
      subscriptionStatus: "active",
    });

    for (const user of users) {
      const fakeReq = { id: user._id } as any;
      const fakeRes = {
        status: () => fakeRes,
        json: (data: any) => console.log(`[autopost] user ${user._id}:`, data),
      } as any;

      try {
        await triggerQuranAutoPost(fakeReq, fakeRes);
      } catch (error) {
        // One user's failure (expired token, API outage, etc.) must not stop the rest of the batch
        console.error(
          `[autopost] user ${user._id} failed:`,
          (error as Error).message,
        );
      }
    }

    console.log("Automated daily Quran auto-post job finished.");
  },
  { timezone: "Africa/Lagos" },
);
