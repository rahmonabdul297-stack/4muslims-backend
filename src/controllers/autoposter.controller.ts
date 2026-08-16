// controllers/autoPoster.controller.ts
import type { Request, Response } from "express";
import { User } from "../models/User.ts";
import { generateQuranContent } from "../services/autogenerate.service.ts";
import {
  publishToInstagramReels,
  publishToYouTube,
} from "../services/socialpublisher.service.ts";
import { sendErrorResponse } from "../utils/helper.ts";

export const updateAutoPostSettings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).id;
    const { enabled, selectedPlatform, defaultReciterId } = req.body;

    // 1. Fetch User and verify Plan Tier
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
          "Automated posting is exclusive to PRO and ULTIMATE subscription plans.",
      });
    }

    // 2. Validate Selected Platform (Strictly ONE platform allowed)
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

    // 3. Determine Frequency Rule Based on Plan
    // PRO Plan = 5 posts per month | ULTIMATE Plan = 1 video per day (DAILY)
    const postFrequency = plan === "ULTIMATE" ? "DAILY" : "5_PER_MONTH";

    // 4. Update Auto-Post Settings
    user.autoPostSettings = {
      enabled: Boolean(enabled),
      selectedPlatform: selectedPlatform
        ? selectedPlatform.toLowerCase()
        : user.autoPostSettings?.selectedPlatform || "facebook",
      defaultReciterId:
        defaultReciterId || user.autoPostSettings?.defaultReciterId || null,
      postFrequency,
      lastAutoPostDate: user.autoPostSettings?.lastAutoPostDate,
      monthlyAutoPostCount: user.autoPostSettings?.monthlyAutoPostCount || 0,
    };

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Automated posting configuration updated successfully.",
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
    const userId = (req as any).id;
    const user = await User.findById(userId);

    if (!user || user.plan === "FREE") {
      return res
        .status(403)
        .json({ success: false, message: "Pro Premium membership required." });
    }
    const quranData = await generateQuranContent();
    const generatedVideoUrl = quranData.audioUrl;

    const publishResults: Record<string, string> = {};

    if (user.socialTokens?.youtube?.accessToken) {
      const ytId = await publishToYouTube(
        user.socialTokens.youtube.accessToken,
        generatedVideoUrl,
        `Surah ${quranData.surahName} [${quranData.ayahNumber}] - Recitation`,
        quranData.description,
      );
      publishResults.youtube = ytId;
    }
    if (
      user.socialTokens?.instagram?.accessToken &&
      user.socialTokens?.instagram?.instagramAccountId
    ) {
      const igId = await publishToInstagramReels(
        user.socialTokens.instagram.accessToken,
        user.socialTokens.instagram.instagramAccountId,
        generatedVideoUrl,
        quranData.description,
      );
      publishResults.instagram = igId;
    }
    return res.status(200).json({
      success: true,
      message: "Quran video generated and posted successfully!",
      quranDetails: {
        surah: quranData.surahName,
        ayah: quranData.ayahNumber,
      },
      publishedPlatforms: publishResults,
    });
  } catch (error) {
    console.error("Auto Post Error:", (error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};
