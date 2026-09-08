import fs from "fs";
import axios from "axios";

export const downloadFileToPath = async (url: string, outputPath: string): Promise<void> => {
  const response = await axios({
    method: "GET",
    url,
    responseType: "stream",
    maxRedirects: 5, // ✅ Ensure HTTP 301/302 redirects from islamic.network are followed
    timeout: 30000,
  });

  // ✅ CHECK CONTENT TYPE: Ensure the CDN didn't return a 200 OK with an HTML error body
  const contentType = response.headers["content-type"];
  if (contentType && !contentType.toString().includes("audio") && !contentType.toString().includes("octet-stream") && !contentType.includes("video")) {
    throw new Error(`Invalid content type received from URL: ${contentType}. Expected audio format.`);
  }

  const writer = fs.createWriteStream(outputPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", (err) => {
      fs.unlink(outputPath, () => {}); // Clean up broken file
      reject(err);
    });
  });
};