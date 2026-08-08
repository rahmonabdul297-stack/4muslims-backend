import { Router } from "express";
import { verifyUserLoginToken } from "../utils/helper.ts";
import { generateCustomVideo, getVideoStatus } from "../controllers/video.controller.ts";


const router = Router();

router.post("/custom", verifyUserLoginToken, generateCustomVideo);
router.get("/status/:jobId", getVideoStatus);

export default router;
