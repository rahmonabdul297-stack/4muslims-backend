import cron from "node-cron";
import { User } from "../models/User.ts";

import {
  publishToYouTube,
  publishToTikTokDirectPost,
  publishToFacebookVideo,
} from "../services/socialpublisher.service.ts";
import { generateQuranContent } from "../services/autogenerate.service.ts";

cron.schedule("0 9 * * *", async () => {
  console.log("Running Daily Premium Quran Auto-Poster Cron Job...");

  try {
    const now = new Date();

    // Query active subscription users who have enabled auto-posting
    const eligibleUsers = await User.find({
      subscriptionStatus: "active",
      plan: { $in: ["PRO", "ULTIMATE"] },
      "autoPostSettings.enabled": true,
    });

    for (const user of eligibleUsers) {
      if (!user) continue;

      const autoPostSettings = user.autoPostSettings;
      const platform = autoPostSettings?.selectedPlatform;
      const reciterId = autoPostSettings?.defaultReciterId;

      // 1. Check Frequency Rules (PRO = 5 posts/month limit, ULTIMATE = Daily)
      if (user.plan === "PRO") {
        const currentCount = autoPostSettings?.monthlyAutoPostCount || 0;
        if (currentCount >= 5) {
          console.log(`User ${user._id} reached 5 posts/month PRO limit. Skipping...`);
          continue;
        }
      }

      // 2. Check if already posted today (for DAILY subscribers)
      if (autoPostSettings?.lastAutoPostDate) {
        const lastPost = new Date(autoPostSettings.lastAutoPostDate);
        const isSameDay =
          lastPost.getFullYear() === now.getFullYear() &&
          lastPost.getMonth() === now.getMonth() &&
          lastPost.getDate() === now.getDate();

        if (isSameDay) {
          console.log(`User ${user._id} already received today's auto-post. Skipping...`);
          continue;
        }
      }

      try {
        // 3. Generate Quran content formatted specifically for target platform
        const quranData = await generateQuranContent(reciterId, platform);
        let postId: string | null = null;

        // 4. Dispatch to selected platform
        switch (platform) {
          case "youtube": {
            const token = user.socialTokens?.youtube?.accessToken;
            if (!token) {
              console.warn(`User ${user._id} lacks YouTube access token.`);
              continue;
            }
            postId = await publishToYouTube(
              token,
              quranData.audioUrl,
              quranData.title,
              quranData.description
            );
            break;
          }

          case "tiktok": {
            const token = user.socialTokens?.tiktok?.accessToken;
            if (!token) {
              console.warn(`User ${user._id} lacks TikTok access token.`);
              continue;
            }
            postId = await publishToTikTokDirectPost(
              token,
              quranData.audioUrl,
              quranData.title
            );
            break;
          }

          case "facebook": {
            const pageToken = user.socialTokens?.facebook?.accessToken;
            const pageId = user.socialTokens?.facebook?.pageId;
            if (!pageToken || !pageId) {
              console.warn(`User ${user._id} lacks Facebook Page credentials.`);
              continue;
            }
            postId = await publishToFacebookVideo(
              pageToken,
              pageId,
              quranData.audioUrl,
              quranData.description
            );
            break;
          }

          default:
            console.warn(`User ${user._id} has an unsupported platform: ${platform}`);
            continue;
        }

        // 5. Update user post timestamps & counters
        user.autoPostSettings.lastAutoPostDate = now;
        user.autoPostSettings.monthlyAutoPostCount = (user.autoPostSettings.monthlyAutoPostCount || 0) + 1;
        await user.save();

        console.log(`Successfully posted Quran video for User ${user._id} to ${platform.toUpperCase()} (Post ID: ${postId})`);
      } catch (postError) {
        console.error(
          `Failed auto-posting for User ${user._id} on ${platform}:`,
          (postError as Error).message
        );
      }
    }
  } catch (cronError) {
    console.error("Cron Job Execution Error:", (cronError as Error).message);
  }
});