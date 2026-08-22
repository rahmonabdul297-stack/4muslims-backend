"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishToFacebookVideo =
  exports.publishToTikTokDirectPost =
  exports.publishToYouTube =
    void 0;
const axios_1 = __importDefault(require("axios"));
// 1. YouTube Data API v3 Upload
const publishToYouTube = async (accessToken, videoUrl, title, description) => {
  // YouTube expects a direct upload or video insertion via resumable upload protocol
  const response = await axios_1.default.post(
    "https://www.googleapis.com/youtube/v3/videos?part=snippet,status",
    {
      snippet: {
        title,
        description,
        categoryId: "22", // People & Blogs
      },
      status: {
        privacyStatus: "public",
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );
  return response.data.id;
};
exports.publishToYouTube = publishToYouTube;
// 2. TikTok Direct Post API
const publishToTikTokDirectPost = async (accessToken, videoUrl, title) => {
  // Initialize TikTok direct post via URL source
  const initResponse = await axios_1.default.post(
    "https://open.tiktokapis.com/v2/post/publish/video/init/",
    {
      post_info: {
        title: title.slice(0, 150),
        privacy_level: "PUBLIC_TO_EVERYONE",
        disable_duet: false,
        disable_stitch: false,
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: videoUrl,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
    },
  );
  return initResponse.data.data.publish_id;
};
exports.publishToTikTokDirectPost = publishToTikTokDirectPost;
// 3. Facebook Graph API Page Video Upload
const publishToFacebookVideo = async (
  pageToken,
  pageId,
  videoUrl,
  title,
  description,
) => {
  const response = await axios_1.default.post(
    `https://graph.facebook.com/v19.0/${pageId}/videos`,
    {
      file_url: videoUrl,
      title,
      description,
      access_token: pageToken,
    },
  );
  return response.data.id;
};
exports.publishToFacebookVideo = publishToFacebookVideo;
//# sourceMappingURL=socialpublisher.service.js.map
