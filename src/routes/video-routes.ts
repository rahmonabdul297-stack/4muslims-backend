import { Router } from "express";
import { requirePremium, verifyUserLoginToken } from "../utils/helper.ts";
import {
  generateCustomVideo,
  generatedVideoHistory,
  getVideoStatus,
} from "../controllers/video.controller.ts";
import { checkAndDeductUsage } from "../controllers/user/generate-video.ts";
import {
  triggerQuranAutoPost,
  updateAutoPostSettings,
} from "../controllers/autoposter.controller.ts";

const router = Router();

router.post(
  "/custom",
  verifyUserLoginToken,
  checkAndDeductUsage,
  generateCustomVideo,
);
router.get("/status/:jobId", getVideoStatus);
router.get("/history", verifyUserLoginToken, generatedVideoHistory);

router.put(
  "/settings",
  verifyUserLoginToken,
  requirePremium,
  updateAutoPostSettings,
);

// Trigger manual automated post
router.post(
  "/trigger",
  verifyUserLoginToken,
  requirePremium,
  triggerQuranAutoPost,
);

export default router;
