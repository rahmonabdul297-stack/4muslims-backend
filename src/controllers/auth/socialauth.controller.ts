import type { Request, Response } from "express";
import axios from "axios";
import { google } from "googleapis";
import jwt from "jsonwebtoken";
import { User } from "../../models/User.ts";

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  process.env.YOUTUBE_REDIRECT_URI,
);

// Separate client for "Sign in with Google" — distinct scopes/redirect from the YouTube-connect feature above
const googleLoginClient = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

// -------------------------------------------------------------
// YOUTUBE OAUTH
// -------------------------------------------------------------
export const getYouTubeAuthUrl = (req: Request, res: Response) => {
  const userId = (req as any).id;
  const jwtSecret = process.env.JWT_USER_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI?.trim();

  if (!jwtSecret || !redirectUri) {
    return res.status(500).json({
      success: false,
      message: "YouTube OAuth is not configured on the server.",
    });
  }

  const state = jwt.sign(
    { id: userId, purpose: "youtube_connect" },
    jwtSecret,
    { expiresIn: "10m" },
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline", // Ensures we receive a refresh token
    prompt: "consent", // Forces consent to ensure refresh token is returned
    scope: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
    state,
  });
  return res.status(200).json({ success: true, url });
};

export const youtubeCallback = async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    if (!code || typeof state !== "string")
      return res
        .status(400)
        .redirect(`${process.env.FRONTEND_URL}/dashboard?error=missing_code`);

    const jwtSecret = process.env.JWT_USER_SECRET;
    if (!jwtSecret) throw new Error("JWT_USER_SECRET is not configured.");

    const statePayload = jwt.verify(state, jwtSecret) as {
      id?: string;
      purpose?: string;
    };
    if (!statePayload.id || statePayload.purpose !== "youtube_connect") {
      throw new Error("Invalid YouTube OAuth state.");
    }

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

    await User.findByIdAndUpdate(statePayload.id, {
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
// TIKTOK OAUTH
// -------------------------------------------------------------
export const getTikTokAuthUrl = (req: Request, res: Response) => {
  const userId = (req as any).id;
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const redirectUri = process.env.TIKTOK_REDIRECT_URI?.trim();

  if (!clientKey || !redirectUri) {
    return res.status(500).json({
      success: false,
      message: "TikTok OAuth is not configured on the server.",
    });
  }

  const params = new URLSearchParams({
    client_key: clientKey,
    response_type: "code",
    scope: "video.publish,video.upload",
    redirect_uri: redirectUri,
    state: userId,
  });

  return res.status(200).json({
    success: true,
    url: `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`,
  });
};

export const tiktokCallback = async (req: Request, res: Response) => {
  try {
    const { code, state: userId } = req.query as {
      code?: string;
      state?: string;
    };
    const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();
    const redirectUri = process.env.TIKTOK_REDIRECT_URI?.trim();

    if (!code || !userId) throw new Error("Missing TikTok code or state.");
    if (!clientKey || !clientSecret || !redirectUri) {
      throw new Error("TikTok OAuth is not configured on the server.");
    }

    const tokenResponse = await axios.post(
      "https://open.tiktokapis.com/v2/oauth/token/",
      new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    const { access_token: accessToken, refresh_token: refreshToken } =
      tokenResponse.data || {};
    if (!accessToken || !refreshToken) {
      throw new Error("TikTok did not return valid access and refresh tokens.");
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          "socialTokens.tiktok.accessToken": accessToken,
          "socialTokens.tiktok.refreshToken": refreshToken,
        },
      },
      { new: true },
    );
    if (!updatedUser) throw new Error("User not found.");

    return res.redirect(
      `${process.env.FRONTEND_URL}/dashboard?connected=tiktok`,
    );
  } catch (error: any) {
    const message =
      error?.response?.data?.error?.message ||
      error.message ||
      "TikTok OAuth failed";
    console.error("TikTok OAuth Error:", error?.response?.data || error);
    return res.redirect(
      `${process.env.FRONTEND_URL}/dashboard?error=${encodeURIComponent(message)}`,
    );
  }
};

export const getFacebookAuthUrl = (req: Request, res: Response) => {
  const userId = (req as any).id;
  const jwtSecret = process.env.JWT_USER_SECRET;
  const appId = process.env.FACEBOOK_APP_ID?.trim();
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI?.trim();

  if (!jwtSecret || !appId || !redirectUri) {
    return res.status(500).json({
      success: false,
      message: "Facebook OAuth is not configured on the server.",
    });
  }

  // Signed state prevents forging a callback that links a Page to another user's account
  const state = jwt.sign(
    { id: userId, purpose: "facebook_connect" },
    jwtSecret,
    { expiresIn: "10m" },
  );

  const scope =
    "pages_show_list,pages_read_engagement,pages_manage_posts,pages_manage_metadata,pages_read_user_content";
  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${encodeURIComponent(state)}`;
  return res.status(200).json({ success: true, url });
};

export const facebookCallback = async (req: Request, res: Response) => {
  // Flag to check if request came from Postman or direct JSON client
  const isJsonClient =
    req.headers["accept"]?.includes("application/json") ||
    req.headers["user-agent"]?.includes("Postman");

  try {
    // 1. Extract query parameters
    const { code, state, error, error_code, error_message, error_reason } =
      req.query as {
        code?: string;
        state?: string;
        error?: string;
        error_code?: string;
        error_message?: string;
        error_reason?: string;
      };

    // Facebook redirects here with error params instead of code/state when the
    // OAuth dialog itself failed (e.g. app domain/config issues on Meta's side)
    if (error || error_code || error_message) {
      const providerMessage =
        error_message ||
        error_reason ||
        error ||
        "Facebook rejected the connection request.";
      console.error("Facebook OAuth provider error:", req.query);
      if (isJsonClient) {
        return res.status(400).json({
          success: false,
          message: providerMessage,
          receivedQuery: req.query,
        });
      }
      return res.redirect(
        `${process.env.FRONTEND_URL}/dashboard?error=${encodeURIComponent(providerMessage)}`,
      );
    }

    if (!code || !state) {
      if (isJsonClient) {
        return res.status(400).json({
          success: false,
          message: "Missing code or state in query parameters.",
          receivedQuery: req.query,
        });
      }
      return res.redirect(
        `${process.env.FRONTEND_URL}/dashboard?error=${encodeURIComponent("Missing code or state in Facebook callback.")}`,
      );
    }

    const jwtSecret = process.env.JWT_USER_SECRET;
    if (!jwtSecret) throw new Error("JWT_USER_SECRET is not configured.");

    let statePayload: { id?: string; purpose?: string };
    try {
      statePayload = jwt.verify(state, jwtSecret) as {
        id?: string;
        purpose?: string;
      };
    } catch {
      throw new Error(
        "Facebook connection request expired or is invalid. Please try connecting again.",
      );
    }
    if (!statePayload.id || statePayload.purpose !== "facebook_connect") {
      throw new Error("Invalid Facebook OAuth state.");
    }
    const userId = statePayload.id;

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
      },
    );

    const shortLivedToken = tokenRes.data?.access_token;
    if (!shortLivedToken) {
      throw new Error(
        "Failed to obtain short-lived access token from Facebook.",
      );
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
      },
    );

    const longLivedToken = longLivedRes.data?.access_token;
    const longLivedExpiresIn = longLivedRes.data?.expires_in as
      | number
      | undefined;
    if (!longLivedToken) {
      // Falling back to the short-lived token here would silently produce a
      // Page token that dies within ~1-2 hours instead of ~60 days.
      throw new Error(
        "Failed to exchange Facebook token for a long-lived session. Please try reconnecting.",
      );
    }

    // 4. Fetch Pages and Page Access Token
    const pagesRes = await axios.get(
      "https://graph.facebook.com/v19.0/me/accounts",
      {
        params: { access_token: longLivedToken },
      },
    );

    const page = pagesRes.data?.data?.[0];
    if (!page) {
      const errorMsg = "No Facebook Pages found associated with this account.";
      if (isJsonClient) {
        return res.status(404).json({ success: false, message: errorMsg });
      }
      return res.redirect(
        `${process.env.FRONTEND_URL}/dashboard?error=${encodeURIComponent(errorMsg)}`,
      );
    }

    // Publishing must use the Page token returned by /me/accounts.
    if (!page.access_token) {
      throw new Error(
        "Facebook did not return a Page access token. Reconnect the Page and grant Page publishing permissions.",
      );
    }

    const finalAccessToken = page.access_token;
    // Page tokens derived from a long-lived User token are generally long-lived
    // themselves; store an estimate so callers can proactively detect staleness.
    const expiresAt = longLivedExpiresIn
      ? new Date(Date.now() + longLivedExpiresIn * 1000)
      : null;

    // 5. Save tokens to database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          "socialTokens.facebook.accessToken": finalAccessToken,
          "socialTokens.facebook.pageId": page.id,
          "socialTokens.facebook.expiresAt": expiresAt,
          "socialProfiles.facebook": `https://facebook.com/${page.id}`,
        },
      },
      { new: true },
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
      `${process.env.FRONTEND_URL}/dashboard?connected=facebook`,
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
      `${process.env.FRONTEND_URL}/dashboard?error=${encodeURIComponent(errorMessage)}`,
    );
  }
};

// -------------------------------------------------------------
// GOOGLE LOGIN (regular user sign-in, not the YouTube-connect feature above)
// -------------------------------------------------------------
export const getGoogleAuthUrl = (req: Request, res: Response) => {
  const jwtSecret = process.env.JWT_USER_SECRET;
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();

  if (!jwtSecret || !clientId || !clientSecret || !redirectUri) {
    return res.status(500).json({
      success: false,
      message: "Google sign-in is not configured on the server.",
    });
  }

  // No user id yet at this point (this is a login entrypoint, not an authenticated "connect")
  const state = jwt.sign({ purpose: "google_login" }, jwtSecret, {
    expiresIn: "10m",
  });

  const url = googleLoginClient.generateAuthUrl({
    access_type: "online",
    prompt: "consent",
    scope: ["openid", "email", "profile"],
    state,
  });

  return res.redirect(url);
};

export const googleCallback = async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || typeof state !== "string") {
      throw new Error("Missing code or state from Google.");
    }

    const jwtSecret = process.env.JWT_USER_SECRET;
    if (!jwtSecret) throw new Error("JWT_USER_SECRET is not configured.");

    try {
      const statePayload = jwt.verify(state, jwtSecret) as {
        purpose?: string;
      };
      if (statePayload.purpose !== "google_login") {
        throw new Error("Invalid state purpose.");
      }
    } catch {
      throw new Error(
        "Google sign-in request expired or is invalid. Please try again.",
      );
    }

    const { tokens } = await googleLoginClient.getToken(code);
    googleLoginClient.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: googleLoginClient });
    const { data: profile } = await oauth2.userinfo.get();

    const email = profile.email?.toLowerCase();
    if (!email) {
      throw new Error(
        "Google did not return an email address for this account.",
      );
    }
    if (profile.verified_email === false) {
      throw new Error("Your Google account's email address is not verified.");
    }

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name: profile.name || email.split("@")[0],
        email,
        authProvider: "google",
        isVerified: true,
        profileImage: profile.picture || undefined,
      });
    } else if (!user.isVerified) {
      // Google already proved ownership of this email address
      user.isVerified = true;
      await user.save();
    }

    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;
    if (!refreshTokenSecret) {
      throw new Error("REFRESH_TOKEN_SECRET is not configured.");
    }
    const isProduction = process.env.NODE_ENV === "production";

    // Session cookies mirror the email/password Login controller for consistency
    const accessToken = jwt.sign({ id: user._id }, jwtSecret, {
      expiresIn: "7d",
    });
    res.cookie(String(user._id), accessToken, {
      path: "/",
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
    });

    const initialRefreshToken = jwt.sign(
      { id: user._id, sessionType: "initial" },
      refreshTokenSecret,
      { expiresIn: "15m" },
    );
    res.cookie("refreshToken", initialRefreshToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      expires: new Date(Date.now() + 1000 * 60 * 15),
    });

    return res.redirect(`${process.env.FRONTEND_URL}/dashboard?login=google`);
  } catch (error: any) {
    const message =
      error?.response?.data?.error_description ||
      error.message ||
      "Google sign-in failed.";
    console.error("Google Login Error:", error?.response?.data || error);
    return res.redirect(
      `${process.env.FRONTEND_URL}/login?error=${encodeURIComponent(message)}`,
    );
  }
};
