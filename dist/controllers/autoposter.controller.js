"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerQuranAutoPost = exports.updateAutoPostSettings = void 0;
const User_ts_1 = require("../models/User.ts");
const autogenerate_service_ts_1 = require("../services/autogenerate.service.ts");
const socialpublisher_service_ts_1 = require("../services/socialpublisher.service.ts");
const video_service_ts_1 = require("../services/video.service.ts");
const updateAutoPostSettings = async (req, res) => {
    try {
        const userId = req.id;
        // Fetch User & verify subscription
        const user = await User_ts_1.User.findById(userId);
        if (!user) {
            return res
                .status(404)
                .json({ success: false, message: "User not found." });
        }
        const plan = user.plan?.toUpperCase();
        const isEligible = user.subscriptionStatus === "active" &&
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
        if (selectedPlatform &&
            !ALLOWED_PLATFORMS.includes(selectedPlatform.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: "Invalid platform. You can only select ONE of: youtube, tiktok, or facebook.",
            });
        }
        // Determine plan frequency (PRO = 5/month, ULTIMATE = Daily)
        const postFrequency = plan === "ULTIMATE" ? "DAILY" : "5_PER_MONTH";
        // Update autoPostSettings safely with exactOptionalPropertyTypes compliance
        user.autoPostSettings = {
            enabled: Boolean(enabled),
            selectedPlatform: selectedPlatform
                ? selectedPlatform.toLowerCase()
                : user.autoPostSettings?.selectedPlatform || "facebook",
            defaultReciterId: defaultReciterId !== undefined
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
                    allowedFrequency: plan === "ULTIMATE" ? "1 video per day" : "5 posts per month",
                    singlePlatformConstraint: true,
                },
            },
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to update auto-post settings.",
        });
    }
};
exports.updateAutoPostSettings = updateAutoPostSettings;
const triggerQuranAutoPost = async (req, res) => {
    try {
        const userId = req.id;
        const user = await User_ts_1.User.findById(userId);
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
        const platform = autoPostSettings.selectedPlatform;
        // 1. Fetch verse, recitation audio, and platform-tailored copy
        const quranData = await (0, autogenerate_service_ts_1.generateQuranContent)(autoPostSettings.defaultReciterId, platform);
        // 2. Generate video asset (.mp4)
        const videoUrl = await (0, video_service_ts_1.generateVideoFromAudio)({
            audioUrl: quranData.audioUrl,
            arabicText: quranData.arabicText,
            translation: quranData.translation,
            surahName: quranData.surahName,
            ayahNumber: quranData.ayahNumber,
        });
        let postId = null;
        // 3. Dispatch to selected social platform
        switch (platform) {
            case "youtube": {
                const token = user.socialTokens?.youtube?.accessToken;
                postId = await (0, socialpublisher_service_ts_1.publishToYouTube)(token, videoUrl, quranData.title, quranData.description);
                break;
            }
            case "tiktok": {
                const token = user.socialTokens?.tiktok?.accessToken;
                postId = await (0, socialpublisher_service_ts_1.publishToTikTokDirectPost)(token, videoUrl, quranData.title);
                break;
            }
            case "facebook": {
                const pageToken = user.socialTokens?.facebook?.accessToken;
                const pageId = user.socialTokens?.facebook?.pageId;
                if (!pageToken || !pageId) {
                    return res.status(400).json({
                        success: false,
                        message: "Facebook Page is not connected. Reconnect it before posting.",
                    });
                }
                postId = await (0, socialpublisher_service_ts_1.publishToFacebookVideo)(pageToken, pageId, videoUrl, quranData.title, quranData.description);
                break;
            }
        }
        // 4. Record execution timestamp and post count
        user.autoPostSettings.lastAutoPostDate = new Date();
        user.autoPostSettings.monthlyAutoPostCount =
            (user.autoPostSettings.monthlyAutoPostCount || 0) + 1;
        user.markModified("autoPostSettings");
        await user.save();
        return res.status(200).json({
            success: true,
            message: `Quran video generated and posted to ${platform.toUpperCase()} successfully!`,
            publishedPostId: postId,
        });
    }
    catch (error) {
        console.error("Auto Post Error:", error?.response?.data || error.message);
        return res.status(500).json({
            success: false,
            message: error?.response?.data?.error?.message || error.message,
        });
    }
};
exports.triggerQuranAutoPost = triggerQuranAutoPost;
//# sourceMappingURL=autoposter.controller.js.map