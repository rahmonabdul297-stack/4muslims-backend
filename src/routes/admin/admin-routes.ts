import { Router } from "express";
import { deleteUser, getAllUsers } from "../../controllers/admin/users.ts";
import {
  deleteVideo,
  getVideos,
  postVideo,
} from "../../controllers/admin/video.ts";
import {
  getStorageStats,
  triggerStorageCleanup,
} from "../../controllers/admin/storage.ts";
import fileUpload from "../../multer.ts";

const router = Router();
// audience
router.get("/users", getAllUsers);
router.delete("/delete/:id", deleteUser);
// upload multiple videos
router.post("/post-videos", fileUpload.array("videos"), postVideo);
router.get("/videos", getVideos);
router.delete("/video/:id", deleteVideo);
// storage management
router.get("/storage/stats", getStorageStats);
router.post("/storage/cleanup", triggerStorageCleanup);

export default router;
