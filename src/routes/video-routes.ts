import { Router } from "express";
import { verifyUserLoginToken } from "../utils/helper.ts";
import {
  generateCustomVideo,
  generatedVideoHistory,
  getVideoStatus,
} from "../controllers/video.controller.ts";

const router = Router();

router.post("/custom", verifyUserLoginToken, generateCustomVideo);
router.get("/status/:jobId", getVideoStatus);
router.get("/history", verifyUserLoginToken, generatedVideoHistory);

export default router;
