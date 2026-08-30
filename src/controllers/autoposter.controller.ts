// controllers/autoPoster.controller.ts
import type { Request, Response } from "express";
import { User } from "../models/User.ts";
import { generateQuranContent } from "../services/autogenerate.service.ts";
import {
  publishToYouTube,
  publishToTikTokDirectPost,
  publishToFacebookVideo,
} from "../services/socialpublisher.service.ts";
import { generateVideoFromAudio } from "../services/video.service.ts";
import { GeneratedVideo } from "../models/generatevideo.ts";
import { PLAN_CONFIGS } from "../config/plan.config.ts";
import { agenda, AUTOPOST_JOB } from "../queues/videorender.ts";
export const updateAutoPostSettings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).id;

    // Fetch User & verify subscription
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const plan = user.plan?.toUpperCase();
    const isEligible =
      user.subscriptionStatus === "active" &&
      (plan === "PRO" || plan === "ULTIMATE");

    if (!isEligible) {
      return res.status(403).json({
        success: false,
        message:
          "Automated posting is exclusive to active PRO and ULTIMATE plans.",
      });
    }

    const { enabled, selectedPlatform, defaultReciterId } = req.body;

    // Validate platform choice (Strictly 1 allowed)
    const ALLOWED_PLATFORMS = ["youtube", "tiktok", "facebook"];
    if (
      selectedPlatform &&
      !ALLOWED_PLATFORMS.includes(selectedPlatform.toLowerCase())
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid platform. You can only select ONE of: youtube, tiktok, or facebook.",
      });
    }

    // Determine plan frequency (PRO = 5/month, ULTIMATE = Daily)
    const postFrequency = plan === "ULTIMATE" ? "DAILY" : "5_PER_MONTH";

    // Update autoPostSettings safely with exactOptionalPropertyTypes compliance
    user.autoPostSettings = {
      enabled: Boolean(enabled),
      selectedPlatform: selectedPlatform
        ? (selectedPlatform.toLowerCase() as "youtube" | "tiktok" | "facebook")
        : user.autoPostSettings?.selectedPlatform || "facebook",
      defaultReciterId:
        defaultReciterId !== undefined
          ? defaultReciterId
          : (user.autoPostSettings?.defaultReciterId ?? null),
      postFrequency,
      lastAutoPostDate: user.autoPostSettings?.lastAutoPostDate ?? null,
      monthlyAutoPostCount: user.autoPostSettings?.monthlyAutoPostCount ?? 0,
    };

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Automated posting settings updated successfully.",
      data: {
        planTier: plan,
        settings: user.autoPostSettings,
        rules: {
          allowedFrequency:
            plan === "ULTIMATE" ? "1 video per day" : "5 posts per month",
          singlePlatformConstraint: true,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update auto-post settings.",
    });
  }
};

/**
 * Does the actual heavy lifting (verse fetch, ffmpeg render, social publish).
 * Runs inside the Agenda worker, never inside an HTTP request — a render can
 * take minutes, far longer than any platform's request timeout would allow.
 */
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

  // Reset the monthly counter once a new calendar month begins
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

  // 1. Fetch verse, recitation audio, and platform-tailored copy
  const quranData = await generateQuranContent(
    autoPostSettings.defaultReciterId,
    platform,
  );

  // 2. Generate video asset (.mp4)
  const generatedVideo = await generateVideoFromAudio({
    audioUrl: quranData.audioUrl,
    arabicText: quranData.arabicText,
    translation: quranData.translation,
    surahName: quranData.surahName,
    ayahNumber: quranData.ayahNumber,
    userId: String(user._id),
  });
  const videoUrl = generatedVideo.videoUrl;

  // Cap stored generated-video records per user at 5; evict the oldest first
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

  // 3. Dispatch to selected social platform
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
        quranData.title,
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

  // 4. Record execution timestamp and post count
  user.autoPostSettings.lastAutoPostDate = new Date();
  user.autoPostSettings.monthlyAutoPostCount =
    (user.autoPostSettings.monthlyAutoPostCount || 0) + 1;
  user.markModified("autoPostSettings");
  await user.save();

  console.log(
    `[autopost] user ${userId}: posted to ${platform} (postId=${postId ?? "n/a"})`,
  );
};

export const triggerQuranAutoPost = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).id;
    const user = await User.findById(userId);

    if (!user || user.subscriptionStatus !== "active") {
      return res.status(403).json({
        success: false,
        message: "Active subscription required for automated posting.",
      });
    }

    const autoPostSettings = user.autoPostSettings;
    if (!autoPostSettings?.enabled) {
      return res.status(400).json({
        success: false,
        message: "Automated posting is currently disabled in settings.",
      });
    }

    // Enforce plan-based frequency/quota: FREE blocked, PRO 5/month, ULTIMATE daily up to plan cap
    const plan =
      (user.plan?.toUpperCase() as keyof typeof PLAN_CONFIGS) || "FREE";
    const planConfig = PLAN_CONFIGS[plan] ?? PLAN_CONFIGS.FREE;

    if (planConfig.autoPostLimit === 0) {
      return res.status(403).json({
        success: false,
        message: "Automated posting is not available on the Free plan.",
      });
    }

    const now = new Date();
    const lastPostDate = autoPostSettings.lastAutoPostDate
      ? new Date(autoPostSettings.lastAutoPostDate)
      : null;

    const isNewMonth =
      !lastPostDate ||
      lastPostDate.getUTCFullYear() !== now.getUTCFullYear() ||
      lastPostDate.getUTCMonth() !== now.getUTCMonth();
    const effectiveCount = isNewMonth
      ? 0
      : autoPostSettings.monthlyAutoPostCount || 0;

    if (
      planConfig.autoPostLimit !== -1 &&
      effectiveCount >= planConfig.autoPostLimit
    ) {
      return res.status(429).json({
        success: false,
        message: `Monthly automated posting limit reached (${planConfig.autoPostLimit}). Upgrade your plan for more posts.`,
      });
    }

    // Rendering + publishing happens off-request, in the Agenda worker
    const job = await agenda.now(AUTOPOST_JOB, { userId: String(user._id) });

    return res.status(202).json({
      success: true,
      message: "Auto-post has been queued and will run in the background.",
      data: { jobId: String(job.attrs._id) },
    });
  } catch (error: any) {
    console.error("Auto Post Error:", error?.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: error?.response?.data?.error?.message || error.message,
    });
  }
};
