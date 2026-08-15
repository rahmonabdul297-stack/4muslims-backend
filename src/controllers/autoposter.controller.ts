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
    const { enabled, postFrequency, platforms } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.isPremium) {
      return res
        .status(403)
        .json({ success: false, message: "Pro Premium membership required." });
    }

    user.autoPostSettings = { enabled, postFrequency, platforms };
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Automated posting settings updated successfully.",
      data: user.autoPostSettings,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: (error as Error).message });
  }
};
export const triggerQuranAutoPost = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).id;
    const user = await User.findById(userId);

    if (!user || user.isPremium===false) {
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
