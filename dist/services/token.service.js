"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.facebookCallback =
  exports.tiktokCallback =
  exports.youtubeCallback =
    void 0;
// GET /api/auth/youtube/callback?code=AUTHORIZATION_CODE
const googleapis_1 = require("googleapis");
const User_ts_1 = require("../models/User.ts");
const axios_1 = __importDefault(require("axios"));
const oauth2Client = new googleapis_1.google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  process.env.YOUTUBE_REDIRECT_URI,
);
const youtubeCallback = async (req, res) => {
  const userId = req.id;
  const { code } = req.query;
  // Exchange authorization code for tokens
  const { tokens } = await oauth2Client.getToken(code);
  // Save tokens to MongoDB
  await User_ts_1.User.findByIdAndUpdate(userId, {
    $set: {
      "socialTokens.youtube.accessToken": tokens.access_token,
      "socialTokens.youtube.refreshToken": tokens.refresh_token, // Provided on first consent
    },
  });
  return res.redirect("/dashboard?status=youtube_connected");
};
exports.youtubeCallback = youtubeCallback;
const tiktokCallback = async (req, res) => {
  const userId = req.id;
  const { code } = req.query;
  const response = await axios_1.default.post(
    "https://open.tiktokapis.com/v2/oauth/token/",
    new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: process.env.TIKTOK_REDIRECT_URI,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );
  const { access_token, refresh_token } = response.data;
  // Save tokens to MongoDB
  await User_ts_1.User.findByIdAndUpdate(userId, {
    $set: {
      "socialTokens.tiktok.accessToken": access_token,
      "socialTokens.tiktok.refreshToken": refresh_token,
    },
  });
  return res.redirect("/dashboard?status=tiktok_connected");
};
exports.tiktokCallback = tiktokCallback;
const facebookCallback = async (req, res) => {
  const userId = req.id;
  const { code } = req.query;
  // 1. Get Short-Lived User Access Token
  const tokenRes = await axios_1.default.get(
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
  const shortLivedToken = tokenRes.data.access_token;
  // 2. Exchange for Long-Lived Token
  const longLivedRes = await axios_1.default.get(
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
  const longLivedToken = longLivedRes.data.access_token;
  // 3. Fetch User's Pages (Returns page access_token and page id)
  const pagesRes = await axios_1.default.get(
    "https://graph.facebook.com/v19.0/me/accounts",
    {
      params: { access_token: longLivedToken },
    },
  );
  const page = pagesRes.data.data[0]; // First Facebook Page selected
  // Save Page Access Token & Page ID to MongoDB
  await User_ts_1.User.findByIdAndUpdate(userId, {
    $set: {
      "socialTokens.facebook.accessToken": page.access_token,
      "socialTokens.facebook.pageId": page.id,
      "socialProfiles.facebook": `https://facebook.com/${page.id}`,
    },
  });
  return res.redirect("/dashboard?status=facebook_connected");
};
exports.facebookCallback = facebookCallback;
//# sourceMappingURL=token.service.js.map
