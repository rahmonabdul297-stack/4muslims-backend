// controllers/autoPoster.controller.ts
import type { Request, Response } from "express";
import { User } from "../models/User.ts";
import { generateQuranContent } from "../services/autogenerate.service.ts";
import {
  publishToYouTube,
  publishToTikTokDirectPost,
  publishToFacebookVideo,
} from "../services/socialpublisher.service.ts";
import { sendErrorResponse } from "../utils/helper.ts";

export const updateAutoPostSettings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).id;

    // Fetch User & verify subscription
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const plan = user.plan?.toUpperCase();
    const isEligible =
      user.subscriptionStatus === "active" &&
      (plan === "PRO" || plan === "ULTIMATE");

    if (!isEligible) {
      return res.status(403).json({
        success: false,
        message: "Automated posting is exclusive to active PRO and ULTIMATE plans.",
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
          : user.autoPostSettings?.defaultReciterId ?? null,
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

export const triggerQuranAutoPost = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).id || (req as any).user?._id;
    const user = await User.findById(userId);

    if (!user || user.plan === "FREE") {
      return res.status(403).json({
        success: false,
        message: "Pro or Ultimate subscription required for automated posting.",
      });
    }

    const autoPostSettings = user.autoPostSettings;
    if (!autoPostSettings?.enabled) {
      return res.status(400).json({
        success: false,
        message: "Automated posting is currently disabled in your settings.",
      });
    }

    const platform = autoPostSettings.selectedPlatform;
    
    // Generate content using configured reciter preference
    const quranData = await generateQuranContent(autoPostSettings.defaultReciterId);
    const generatedVideoUrl = quranData.audioUrl;
    const videoTitle = `Surah ${quranData.surahName} [${quranData.ayahNumber}] - Recitation`;

    let postId: string | null = null;

    // Dispatch strictly to selected platform
    switch (platform) {
      case "youtube": {
        const token = user.socialTokens?.youtube?.accessToken;
        if (!token) {
          return res.status(400).json({
            success: false,
            message: "YouTube account is not connected.",
          });
        }
        postId = await publishToYouTube(
          token,
          generatedVideoUrl,
          videoTitle,
          quranData.description
        );
        break;
      }

      case "tiktok": {
        const token = user.socialTokens?.tiktok?.accessToken;
        if (!token) {
          return res.status(400).json({
            success: false,
            message: "TikTok account is not connected.",
          });
        }
        postId = await publishToTikTokDirectPost(
          token,
          generatedVideoUrl,
          videoTitle
        );
        break;
      }

      case "facebook": {
        const pageToken = user.socialTokens?.facebook?.accessToken;
        const pageId = user.socialTokens?.facebook?.pageId;
        if (!pageToken || !pageId) {
          return res.status(400).json({
            success: false,
            message: "Facebook Page is not fully connected.",
          });
        }
        postId = await publishToFacebookVideo(
          pageToken,
          pageId,
          generatedVideoUrl,
          quranData.description
        );
        break;
      }

      default:
        return res.status(400).json({
          success: false,
          message: `Unsupported platform: ${platform}`,
        });
    }

    // Update execution history counters
    user.autoPostSettings.lastAutoPostDate = new Date();
    user.autoPostSettings.monthlyAutoPostCount =
      (user.autoPostSettings.monthlyAutoPostCount || 0) + 1;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `Quran video generated and posted to ${platform.toUpperCase()} successfully!`,
      quranDetails: {
        surah: quranData.surahName,
        ayah: quranData.ayahNumber,
      },
      publishedPlatform: platform,
      publishedPostId: postId,
    });
  } catch (error) {
    console.error("Auto Post Error:", (error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};