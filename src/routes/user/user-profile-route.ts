import { Router } from "express";

import {
  getUserProfile,
  updateUserProfile,
} from "../../controllers/user/user-profile-controller.ts";
import fileUpload from "../../multer.ts";
import { verifyUserLoginToken } from "../../utils/helper.ts";

import { getMe } from "../../controllers/user/user-auth-controller.ts";
const router = Router();
router.get("/me", verifyUserLoginToken, getMe);
router.put(
  "/update-profile",
  verifyUserLoginToken,
  fileUpload.single("image"),
  updateUserProfile,
);

export default router;
