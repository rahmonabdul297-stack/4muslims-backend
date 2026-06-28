import { Router } from "express";
import {
  verifyUsersigninToken,
} from "../../controllers/user/user-auth-controller.ts";
import { getUserProfile } from "../../controllers/user/user-profile-controller.ts";
const router = Router();
router.get("/verify-Token", verifyUsersigninToken, getUserProfile);

export default router;
