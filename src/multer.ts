// middlewares/upload.middleware.ts
import multer from "multer";
import path from "path";
import fs from "fs";

// Create temporary upload directory
const uploadDir = path.join(process.cwd(), "tmp_uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

 const fileUpload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB max limit
  },
});
export default fileUpload;