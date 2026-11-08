import { User } from "../models/User.ts";
import { PLAN_CONFIGS } from "../config/plan.config.ts";
import { generateQuranContent } from "../services/autogenerate.service.ts";
import {
  publishToFacebookVideo,
  publishToTikTokDirectPost,
  publishToYouTube,
} from "../services/socialpublisher.service.ts";
import { generateVideoFromAudio } from "../services/video.service.ts";
import { GeneratedVideo } from "../models/generatevideo.ts";

export const executeAutoPostForUser = async (userId: string): Promise<void> => {
  const user = await User.findById(userId);
  if (!user || user.subscriptionStatus !== "active") {
    console.warn(`[autopost] Skipping user ${userId}: inactive subscription`);
    return;
  }

  const autoPostSettings = user.autoPostSettings;
  if (!autoPostSettings?.enabled) {
    console.warn(`[autopost] Skipping user ${userId}: autopost disabled`);
    return;
  }

  const plan =
    (user.plan?.toUpperCase() as keyof typeof PLAN_CONFIGS) || "FREE";
  const planConfig = PLAN_CONFIGS[plan] ?? PLAN_CONFIGS.FREE;

  if (planConfig.autoPostLimit === 0) {
    console.warn(`[autopost] Skipping user ${userId}: FREE plan`);
    return;
  }

  const now = new Date();
  const lastPostDate = autoPostSettings.lastAutoPostDate
    ? new Date(autoPostSettings.lastAutoPostDate)
    : null;
  const isNewMonth =
    !lastPostDate ||
    lastPostDate.getUTCFullYear() !== now.getUTCFullYear() ||
    lastPostDate.getUTCMonth() !== now.getUTCMonth();
  if (isNewMonth) {
    autoPostSettings.monthlyAutoPostCount = 0;
  }

  if (
    planConfig.autoPostLimit !== -1 &&
    autoPostSettings.monthlyAutoPostCount >= planConfig.autoPostLimit
  ) {
    console.warn(`[autopost] Skipping user ${userId}: monthly quota reached`);
    return;
  }

  const platform = autoPostSettings.selectedPlatform;
  const quranData = await generateQuranContent(
    autoPostSettings.defaultReciterId,
    platform,
  );
  const generatedVideo = await generateVideoFromAudio({
    audioUrl: quranData.audioUrl,
    arabicText: quranData.arabicText,
    translation: quranData.translation,
    surahName: quranData.surahName,
    ayahNumber: quranData.ayahNumber,
    ayahs: quranData.ayahs,
    userId: String(user._id),
  });
  const videoUrl = generatedVideo.videoUrl;

  const MAX_GENERATED_VIDEOS_PER_USER = 5;
  const existingCount = await GeneratedVideo.countDocuments({
    userId: String(user._id),
  });
  if (existingCount >= MAX_GENERATED_VIDEOS_PER_USER) {
    const overflow = existingCount - MAX_GENERATED_VIDEOS_PER_USER + 1;
    const oldestRecords = await GeneratedVideo.find({
      userId: String(user._id),
    })
      .sort({ createdAt: 1 })
      .limit(overflow)
      .select("_id");
    await GeneratedVideo.deleteMany({
      _id: { $in: oldestRecords.map((record) => record._id) },
    });
  }

  await GeneratedVideo.create({
    jobId: `autopost-${Date.now()}`,
    userId: String(user._id),
    templateId: generatedVideo.templateId,
    surahNumber: quranData.surahNumber,
    ayahNumber: quranData.ayahNumber,
    reciterId: quranData.reciterId,
    arabicText: quranData.arabicText,
    translationText: quranData.translation,
    audioUrl: quranData.audioUrl,
    surahName: quranData.surahName,
    status: "completed",
    progress: 100,
    outputUrl: videoUrl,
  });

  let postId: string | null = null;
  switch (platform) {
    case "youtube": {
      const token = user.socialTokens?.youtube?.accessToken;
      if (!token) {
        console.warn(
          `[autopost] user ${userId}: YouTube not connected, skipping publish`,
        );
        break;
      }
      postId = await publishToYouTube(
        token,
        videoUrl,
        quranData.title,
        quranData.description,
      );
      break;
    }
    case "tiktok": {
      const token = user.socialTokens?.tiktok?.accessToken;
      if (!token) {
        console.warn(
          `[autopost] user ${userId}: TikTok not connected, skipping publish`,
        );
        break;
      }
      postId = await publishToTikTokDirectPost(
        token,
        videoUrl,
        quranData.description,
      );
      break;
    }
    case "facebook": {
      const pageToken = user.socialTokens?.facebook?.accessToken;
      const pageId = user.socialTokens?.facebook?.pageId;
      if (!pageToken || !pageId) {
        console.warn(
          `[autopost] user ${userId}: Facebook Page not connected, skipping publish`,
        );
        break;
      }
      postId = await publishToFacebookVideo(
        pageToken,
        pageId,
        videoUrl,
        quranData.title,
        quranData.description,
      );
      break;
    }
  }

  user.autoPostSettings.lastAutoPostDate = new Date();
  user.autoPostSettings.monthlyAutoPostCount =
    (user.autoPostSettings.monthlyAutoPostCount || 0) + 1;
  user.markModified("autoPostSettings");
  await user.save();

  console.log(
    `[autopost] user ${userId}: posted to ${platform} (postId=${postId ?? "n/a"})`,
  );
};
