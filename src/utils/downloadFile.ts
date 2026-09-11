import fs from "fs";
import axios from "axios";

/**
 * Downloads a remote file to a local destination path with exponential backoff retries.
 * Handles temporary 502/503 CDN gateway drops and follows redirects.
 */
export const downloadFileToPath = async (
  url: string,
  outputPath: string,
  retries = 3,
  delayMs = 2000,
): Promise<void> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios({
        method: "GET",
        url,
        responseType: "stream",
        maxRedirects: 5,
        timeout: 35000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "*/*",
        },
      });

      // Verify Content-Type to prevent downloading 200 OK HTML error pages
      const contentType = response.headers["content-type"]?.toString().toLowerCase();
      if (
        contentType &&
        !contentType.includes("audio") &&
        !contentType.includes("video") &&
        !contentType.includes("octet-stream")
      ) {
        throw new Error(
          `Invalid content type received: ${contentType}. Expected audio/video stream.`,
        );
      }

      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", (err) => {
          fs.unlink(outputPath, () => {});
          reject(err);
        });
      });

      return; // Successfully completed download
    } catch (error: any) {
      // Clean up incomplete file write attempt
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      const status = error.response?.status;
      const isServerError = status >= 500 && status <= 599;

      if (
        attempt === retries ||
        (!isServerError && error.code !== "ECONNABORTED" && error.code !== "ETIMEDOUT")
      ) {
        throw new Error(
          `Failed to download file from ${url} (Status: ${status || error.code || "UNKNOWN"}): ${error.message}`,
        );
      }

      console.warn(
        `[downloadFileToPath] Download attempt ${attempt}/${retries} failed (${status || error.code}). Retrying in ${delayMs * attempt}ms...`,
      );

      await new Promise((res) => setTimeout(res, delayMs * attempt));
    }
  }
};