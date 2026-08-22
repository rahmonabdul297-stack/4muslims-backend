"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getValidTikTokToken = exports.getValidYouTubeToken = void 0;
const axios_1 = __importDefault(require("axios"));
// Utility: Ensure valid YouTube access token
const getValidYouTubeToken = async (user) => {
    const refreshToken = user.socialTokens?.youtube?.refreshToken;
    if (!refreshToken)
        throw new Error("YouTube account not connected.");
    const response = await axios_1.default.post("https://oauth2.googleapis.com/token", {
        client_id: process.env.YOUTUBE_CLIENT_ID,
        client_secret: process.env.YOUTUBE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
    });
    const newAccessToken = response.data.access_token;
    if (user.socialTokens?.youtube) {
        user.socialTokens.youtube.accessToken = newAccessToken;
        user.markModified("socialTokens");
        await user.save();
    }
    return newAccessToken;
};
exports.getValidYouTubeToken = getValidYouTubeToken;
// Utility: Ensure valid TikTok access token
const getValidTikTokToken = async (user) => {
    const refreshToken = user.socialTokens?.tiktok?.refreshToken;
    if (!refreshToken)
        throw new Error("TikTok account not connected.");
    const response = await axios_1.default.post("https://open.tiktokapis.com/v2/oauth/token/", new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
    }), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    const newAccessToken = response.data.access_token;
    const newRefreshToken = response.data.refresh_token || refreshToken;
    if (user.socialTokens?.tiktok) {
        user.socialTokens.tiktok.accessToken = newAccessToken;
        user.socialTokens.tiktok.refreshToken = newRefreshToken;
        user.markModified("socialTokens");
        await user.save();
    }
    return newAccessToken;
};
exports.getValidTikTokToken = getValidTikTokToken;
//# sourceMappingURL=socialAuthhelper.js.map