import axios from "axios";

export const publishToYouTube = async (
  accessToken: string,
  videoUrl: string,
  title: string,
  description: string,
): Promise<string> => {
  const response = await axios.post(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=media&part=snippet,status",
    {
      snippet: {
        title,
        description,
        tags: ["Quran", "Islam", "Motivation", "Reminders"],
        categoryId: "22",
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

export const publishToInstagramReels = async (
  accessToken: string,
  instagramAccountId: string,
  videoUrl: string,
  caption: string,
): Promise<string> => {
  const containerResponse = await axios.post(
    `https://graph.facebook.com/v18.0/${instagramAccountId}/media`,
    {
      media_type: "REELS",
      video_url: videoUrl,
      caption,
      access_token: accessToken,
    },
  );

  const containerId = containerResponse.data.id;
  const publishResponse = await axios.post(
    `https://graph.facebook.com/v18.0/${instagramAccountId}/media_publish`,
    {
      creation_id: containerId,
      access_token: accessToken,
    },
  );

  return publishResponse.data.id;
};
