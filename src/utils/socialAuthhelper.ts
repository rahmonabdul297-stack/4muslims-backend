import axios from "axios";
import type { User, UserTypes } from "../models/User.ts"

// Utility: Ensure valid YouTube access token
export const getValidYouTubeToken = async (user: UserTypes): Promise<string> => {
  const refreshToken = user.socialTokens?.youtube?.refreshToken;
  if (!refreshToken) throw new Error("YouTube account not connected.");

  const response = await axios.post("https://oauth2.googleapis.com/token", {
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

// Utility: Ensure valid TikTok access token
export const getValidTikTokToken = async (user: UserTypes): Promise<string> => {
  const refreshToken = user.socialTokens?.tiktok?.refreshToken;
  if (!refreshToken) throw new Error("TikTok account not connected.");

  const response = await axios.post(
    "https://open.tiktokapis.com/v2/oauth/token/",
    new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

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