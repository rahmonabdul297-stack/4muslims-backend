import axios from "axios";

// 1. YouTube Data API v3 Upload
export const publishToYouTube = async (
  accessToken: string | undefined,
  videoUrl: string,
  title: string,
  description: String,
): Promise<string> => {
  // YouTube expects a direct upload or video insertion via resumable upload protocol
  const response = await axios.post(
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

// 2. TikTok Direct Post API
export const publishToTikTokDirectPost = async (
  accessToken: string | undefined,
  videoUrl: string,
  title: string,
): Promise<string> => {
  // Initialize TikTok direct post via URL source
  const initResponse = await axios.post(
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

// 3. Facebook Graph API Page Video Upload
export const publishToFacebookVideo = async (
  pageToken: string,
  pageId: string,
  videoUrl: string,
  title: string,
  description: string,
): Promise<string> => {
  const response = await axios.post(
    `https://graph.facebook.com/v26.0/${pageId}/videos`,
    {
      file_url: videoUrl,
      title,
      description,
      access_token: pageToken,
    },
  );
  return response.data.id;
};
