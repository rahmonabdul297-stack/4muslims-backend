import type { Request, Response } from "express";
import axios from "axios";
import { google } from "googleapis";
import { User } from "../../models/User.ts";

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  process.env.YOUTUBE_REDIRECT_URI,
);

// -------------------------------------------------------------
// YOUTUBE OAUTH
// -------------------------------------------------------------
export const getYouTubeAuthUrl = (req: Request, res: Response) => {
  const userId = (req as any).id;
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline", // Ensures we receive a refresh token
    prompt: "consent", // Forces consent to ensure refresh token is returned
    scope: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
    state: userId, // Pass userId through OAuth state parameter
  });
  return res.status(200).json({ success: true, url });
};

export const youtubeCallback = async (req: Request, res: Response) => {
  try {
    const { code, state: userId } = req.query;
    if (!code || !userId)
      return res
        .status(400)
        .redirect(`${process.env.FRONTEND_URL}/dashboard?error=missing_code`);

    const { tokens } = await oauth2Client.getToken(code as string);

    // Fetch channel details to construct profileUrl
    oauth2Client.setCredentials(tokens);
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    const channelRes = await youtube.channels.list({
      part: ["snippet"],
      mine: true,
    });
    const channel = channelRes.data.items?.[0];
    const customUrl = channel?.snippet?.customUrl;
    const profileUrl = customUrl
      ? `https://youtube.com/${customUrl}`
      : `https://youtube.com/channel/${channel?.id}`;

    await User.findByIdAndUpdate(userId, {
      $set: {
        "socialTokens.youtube.accessToken": tokens.access_token,
        "socialTokens.youtube.refreshToken": tokens.refresh_token,
        "socialProfiles.youtube": profileUrl,
      },
    });

    return res.redirect(
      `${process.env.FRONTEND_URL}/dashboard?connected=youtube`,
    );
  } catch (error: any) {
    return res.redirect(
      `${process.env.FRONTEND_URL}/dashboard?error=${encodeURIComponent(error.message)}`,
    );
  }
};

// -------------------------------------------------------------
// FACEBOOK OAUTH
// -------------------------------------------------------------
export const getFacebookAuthUrl = (req: Request, res: Response) => {
  const userId = (req as any).id;
  const scope = "pages_show_list,pages_read_engagement,pages_manage_posts";
  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(process.env.FACEBOOK_REDIRECT_URI!)}&scope=${scope}&state=${userId}`;
  return res.status(200).json({ success: true, url });
};

export const facebookCallback = async (req: Request, res: Response) => {
  // Flag to check if request came from Postman or direct JSON client
  const isJsonClient = req.headers["accept"]?.includes("application/json") || req.headers["user-agent"]?.includes("Postman");

  try {
    // 1. Extract query parameters
    const { code, state: userId } = req.query as {
      code?: string;
      state?: string;
    };

    if (!code || !userId) {
      return res.status(400).json({
        success: false,
        message: "Missing code or state (userId) in query parameters.",
        receivedQuery: req.query,
      });
    }

    // 2. Exchange authorization code for short-lived token
    const tokenRes = await axios.get(
      "https://graph.facebook.com/v19.0/oauth/access_token",
      {
        params: {
          client_id: process.env.FACEBOOK_APP_ID,
          client_secret: process.env.FACEBOOK_APP_SECRET,
          redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
          code,
        },
      }
    );

    const shortLivedToken = tokenRes.data?.access_token;
    if (!shortLivedToken) {
      throw new Error("Failed to obtain short-lived access token from Facebook.");
    }

    // 3. Exchange short-lived token for long-lived user token (~60 days)
    const longLivedRes = await axios.get(
      "https://graph.facebook.com/v19.0/oauth/access_token",
      {
        params: {
          grant_type: "fb_exchange_token",
          client_id: process.env.FACEBOOK_APP_ID,
          client_secret: process.env.FACEBOOK_APP_SECRET,
          fb_exchange_token: shortLivedToken,
        },
      }
    );

    const longLivedToken = longLivedRes.data?.access_token || shortLivedToken;

    // 4. Fetch Pages and Page Access Token
    const pagesRes = await axios.get(
      "https://graph.facebook.com/v19.0/me/accounts",
      {
        params: { access_token: longLivedToken },
      }
    );

    const page = pagesRes.data?.data?.[0];
    if (!page) {
      const errorMsg = "No Facebook Pages found associated with this account.";
      if (isJsonClient) {
        return res.status(404).json({ success: false, message: errorMsg });
      }
      return res.redirect(
        `${process.env.FRONTEND_URL}/dashboard?error=${encodeURIComponent(errorMsg)}`
      );
    }

    // Page Access Tokens never expire unless permissions are revoked
    const finalAccessToken = page.access_token || longLivedToken;

    // 5. Save tokens to database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          "socialTokens.facebook.accessToken": finalAccessToken,
          "socialTokens.facebook.pageId": page.id,
          "socialProfiles.facebook": `https://facebook.com/${page.id}`,
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      throw new Error(`User with ID ${userId} not found in database.`);
    }

    // If testing in Postman, return direct JSON instead of attempting browser redirect
    if (isJsonClient) {
      return res.status(200).json({
        success: true,
        message: "Facebook connected successfully.",
        pageId: page.id,
        pageName: page.name,
      });
    }

    return res.redirect(
      `${process.env.FRONTEND_URL}/dashboard?connected=facebook`
    );
  } catch (error: any) {
    const errorMessage =
      error?.response?.data?.error?.message || error.message || "OAuth failed";
    console.error("Facebook OAuth Error:", error?.response?.data || error);

    if (isJsonClient) {
      return res.status(500).json({
        success: false,
        message: errorMessage,
        errorDetails: error?.response?.data || null,
      });
    }

    return res.redirect(
      `${process.env.FRONTEND_URL}/dashboard?error=${encodeURIComponent(errorMessage)}`
    );
  }
};
