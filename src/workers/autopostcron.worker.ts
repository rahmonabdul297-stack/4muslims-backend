import cron from "node-cron";
import { agenda, AUTOPOST_JOB } from "../queues/videorender.ts";
import { User } from "../models/User.ts";

// Runs every day at 2:00 PM Nigerian time (WAT, UTC+1, no DST)
cron.schedule(
  "0 14 * * *",
  async () => {
    console.log("Enqueuing daily Quran auto-post jobs...");

    const users = await User.find({
      "autoPostSettings.enabled": true,
      subscriptionStatus: "active",
    }).select("_id");

    for (const user of users) {
      try {
        // Enqueue only — the actual render/publish runs in the shared Agenda worker,
        // never inside this cron tick, so one slow/stuck user can't block the rest.
        await agenda.now(AUTOPOST_JOB, { userId: String(user._id) });
      } catch (error) {
        console.error(
          `[autopost] Failed to enqueue user ${user._id}:`,
          (error as Error).message,
        );
      }
    }

    console.log(`Enqueued ${users.length} auto-post job(s).`);
  },
  { timezone: "Africa/Lagos" },
);
