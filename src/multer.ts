import multer from "multer";
import { memoryUsage } from "node:process";

const storage = multer.memoryStorage();
const fileUpload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 },
});

export default fileUpload;
