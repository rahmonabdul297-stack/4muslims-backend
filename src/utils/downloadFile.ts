import fs from "fs";
import axios from "axios";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Stream a remote file to a local path. Used to pull template videos and
 * recitation audio into job-scoped scratch space before handing off to ffmpeg.
 */
export const downloadFileToPath = async (
  url: string,
  destPath: string,
): Promise<void> => {
  const parsed = new URL(url);
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(
      `Refusing to download from disallowed protocol: ${parsed.protocol}`,
    );
  }

  const response = await axios.get(url, {
    responseType: "stream",
    timeout: 120000,
    maxRedirects: 5,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);
    writer.on("finish", () => resolve());
    writer.on("error", (err: Error) => reject(err));
    response.data.on("error", (err: Error) => reject(err));
  });
};
