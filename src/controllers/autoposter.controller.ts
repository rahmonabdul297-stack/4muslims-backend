// controllers/autoPoster.controller.ts
import type { Request, Response } from "express";
import { User } from "../models/User.ts";
import { PLAN_CONFIGS } from "../config/plan.config.ts";
import { findReciterConfig } from "../config/reciters.ts";
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

    if (defaultReciterId && !findReciterConfig(defaultReciterId)) {
      return res.status(400).json({
        success: false,
        message: `Invalid defaultReciterId: ${defaultReciterId}.`,
      });
    }

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
    const { agenda, AUTOPOST_JOB } = await import("../queues/videorender.ts");
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
