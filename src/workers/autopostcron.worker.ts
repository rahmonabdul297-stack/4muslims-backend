import cron from "node-cron";
import { User } from "../models/User.ts";
import { generateQuranContent } from "../services/autogenerate.service.ts";
import {
  publishToInstagramReels,
  publishToYouTube,
} from "../services/socialpublisher.service.ts";

cron.schedule("0 9 * * *", async () => {
  console.log("Running Daily Premium Quran Auto-Poster Cron Job...");

  const now = new Date();
  const premiumUsers = await User.find({
    isPremium: true,
    premiumExpiresAt: { $gt: now },
    "autoPostSettings.enabled": true,
  });

  for (const user of premiumUsers) {
    if (!user) {
      return console.log("user error");
    }
    try {
      const quranData = await generateQuranContent();
      const videoUrl = quranData.audioUrl; 

      if (
        user.autoPostSettings?.platforms.includes("youtube") &&
        user.socialTokens?.youtube?.accessToken
      ) {
        await publishToYouTube(
          user.socialTokens.youtube.accessToken,
          videoUrl,
          `Surah ${quranData.surahName} [${quranData.ayahNumber}]`,
          quranData.description,
        );
      }

      if (
        user.autoPostSettings?.platforms.includes("instagram") &&
        user.socialTokens?.instagram?.accessToken
      ) {
        await publishToInstagramReels(
          user.socialTokens.instagram.accessToken,
          user.socialTokens.instagram.instagramAccountId!,
          videoUrl,
          quranData.description,
        );
      }

      console.log(
        `Automatically posted daily Quran video for User: ${user._id}`,
      );
    } catch (err) {
      console.error(
        `Failed auto-posting for user ${user._id}:`,
        (err as Error).message,
      );
    }
  }
});
