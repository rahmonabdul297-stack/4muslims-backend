// GET /api/auth/youtube/callback?code=AUTHORIZATION_CODE
import { google } from "googleapis";
import { User } from "../models/User.ts";
import type { Request, Response } from "express";
import axios from "axios";

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  process.env.YOUTUBE_REDIRECT_URI,
);

export const youtubeCallback = async (req: Request, res: Response) => {
  const userId = (req as any).id;
  const { code } = req.query;

  // Exchange authorization code for tokens
  const { tokens } = await oauth2Client.getToken(code as string);

  // Save tokens to MongoDB
  await User.findByIdAndUpdate(userId, {
    $set: {
      "socialTokens.youtube.accessToken": tokens.access_token,
      "socialTokens.youtube.refreshToken": tokens.refresh_token, // Provided on first consent
    },
  });

  return res.redirect("/dashboard?status=youtube_connected");
};

export const tiktokCallback = async (req: Request, res: Response) => {
  const userId = (req as any).id;
  const { code } = req.query;

  const response = await axios.post(
    "https://open.tiktokapis.com/v2/oauth/token/",
    new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code: code as string,
      grant_type: "authorization_code",
      redirect_uri: process.env.TIKTOK_REDIRECT_URI!,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );

  const { access_token, refresh_token } = response.data;

  // Save tokens to MongoDB
  await User.findByIdAndUpdate(userId, {
    $set: {
      "socialTokens.tiktok.accessToken": access_token,
      "socialTokens.tiktok.refreshToken": refresh_token,
    },
  });

  return res.redirect("/dashboard?status=tiktok_connected");
};

export const facebookCallback = async (req: Request, res: Response) => {
  const userId = (req as any).id;
  const { code } = req.query;

  // 1. Get Short-Lived User Access Token
  const tokenRes = await axios.get(
    "https://graph.facebook.com/v26.0/oauth/access_token",
    {
      params: {
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
        code,
      },
    },
  );
  const shortLivedToken = tokenRes.data.access_token;

  // 2. Exchange for Long-Lived Token
  const longLivedRes = await axios.get(
    "https://graph.facebook.com/v26.0/oauth/access_token",
    {
      params: {
        grant_type: "fb_exchange_token",
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        fb_exchange_token: shortLivedToken,
      },
    },
  );
  const longLivedToken = longLivedRes.data.access_token;

  // 3. Fetch User's Pages (Returns page access_token and page id)
  const pagesRes = await axios.get(
    "https://graph.facebook.com/v26.0/me/accounts",
    {
      params: { access_token: longLivedToken },
    },
  );

  const page = pagesRes.data.data[0]; // First Facebook Page selected

  // Save Page Access Token & Page ID to MongoDB
  await User.findByIdAndUpdate(userId, {
    $set: {
      "socialTokens.facebook.accessToken": page.access_token,
      "socialTokens.facebook.pageId": page.id,
      "socialProfiles.facebook": `https://facebook.com/${page.id}`,
    },
  });

  return res.redirect("/dashboard?status=facebook_connected");
};
