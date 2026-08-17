import { Router } from "express";
import { requirePremium, verifyUserLoginToken } from "../utils/helper.ts";
import {
  generateCustomVideo,
  generatedVideoHistory,
  getVideoStatus,
} from "../controllers/video.controller.ts";
import {
  triggerQuranAutoPost,
  updateAutoPostSettings,
} from "../controllers/autoposter.controller.ts";
import { enforcePlanLimits } from "../middlewares/planguard.ts";

const router = Router();

// Manual video generation route
router.post(
  "/custom",
  verifyUserLoginToken,
  enforcePlanLimits(false),
  generateCustomVideo,
);
router.get("/status/:jobId", getVideoStatus);
router.get("/history", verifyUserLoginToken, generatedVideoHistory);

router.put(
  "/autopostsettings",
  verifyUserLoginToken,
  requirePremium,
  updateAutoPostSettings,
);

// Trigger automated post
router.post(
  "/triggerautopost",
  verifyUserLoginToken,
  requirePremium,
  triggerQuranAutoPost,
);

export default router;
