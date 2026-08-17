import axios from "axios";

export const publishToYouTube = async (
  accessToken: string,
  videoUrl: string,
  title: string,
  description: string,
): Promise<string> => {
  // Step A: Fetch video binary as arraybuffer / stream
  const videoStream = await axios.get(videoUrl, {
    responseType: "arraybuffer",
  });

  const metadata = {
    snippet: {
      title,
      description,
      tags: ["Quran", "Islam", "Motivation", "Reminders"],
      categoryId: "22", // People & Blogs
    },
    status: {
      privacyStatus: "public",
    },
  };

  // Step B: Initialize Resumable Upload Session
  const initResponse = await axios.post(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    metadata,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  const uploadUrl = initResponse.headers.location;

  const uploadResponse = await axios.put(uploadUrl, videoStream.data, {
    headers: {
      "Content-Type": "video/mp4",
    },
  });

  return uploadResponse.data.id;
};

export const publishToFacebookVideo = async (
  pageAccessToken: string,
  pageId: string,
  videoUrl: string,
  description: string,
): Promise<string> => {
  // Facebook Graph API accepts external video URLs directly via file_url parameter
  const response = await axios.post(
    `https://graph.facebook.com/v19.0/${pageId}/videos`,
    {
      file_url: videoUrl,
      description,
      access_token: pageAccessToken,
    },
  );

  return response.data.id;
};
export const publishToTikTokDirectPost = async (
  accessToken: string,
  videoUrl: string,
  title: string,
): Promise<string> => {
  // Step A: Initialize post request on TikTok Direct Post API
  const initResponse = await axios.post(
    "https://open.tiktokapis.com/v2/post/publish/video/init/",
    {
      post_info: {
        title,
        privacy_level: "PUBLIC_TO_EVERYONE",
        disable_duet: false,
        disable_stitch: false,
        disable_comment: false,
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
