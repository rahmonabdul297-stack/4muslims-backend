import { Router } from "express";

import { Validate } from "../../middlewares/validate.ts";

import {
  validateExistingUser,
  validateNewUser,
  validateResetOTP,
  validateResetPassToken,
} from "../../middlewares/user.ts";

import {
  resetUserPassword,
  Login,
  logOut,
  Register,
  userForgotPassword,
  userForgotPasswordOtp,
  verifyAccount,
  getMe,
} from "../../controllers/user/user-auth-controller.ts";
import {
  ValidateNewUserDetails,
  ValidateOTP,
  ValidatePassword,
  ValidatePasswordReset,
  ValidatePhone,
  ValidateLoginDetails,
} from "../../middlewares/Validators.ts";
import {
  sendResetPasswordMail,
  sendLoginMail,
  sendUpdatedPasswordMail,
  sendVerificationCode,
} from "../../services/email-services.ts";
import { sendOtpSMS } from "../../services/otp-services.ts";
import {
  CheckSession,
  refreshSession,
  verifyUserLoginToken,
} from "../../utils/helper.ts";
import {
  facebookCallback,
  getFacebookAuthUrl,
  getYouTubeAuthUrl,
  youtubeCallback,
} from "../../controllers/auth/socialauth.controller.ts";

const router = Router();

router.post(
  "/register",
  ValidateNewUserDetails,
  Validate,
  validateNewUser,
  Register,
  sendVerificationCode,
);
router.post("/verify-account", verifyAccount);
router.post(
  "/login",
  ValidateLoginDetails,
  Validate,
  validateExistingUser,
  Login,
  sendLoginMail,
);
router.post("/logout", verifyUserLoginToken, logOut);
router.get("/me", verifyUserLoginToken, getMe);

router.get("/check-session", CheckSession);
router.post("/refresh", refreshSession);
router.post(
  "/forgot-password",
  ValidatePassword,
  Validate,
  userForgotPassword,
  sendResetPasswordMail,
);
router.post(
  "/SMS/forgot-password",
  ValidatePhone,
  Validate,
  userForgotPasswordOtp,
  sendOtpSMS,
);

router.put(
  "/reset-password",
  ValidatePasswordReset,
  Validate,
  validateResetPassToken,
  resetUserPassword,
  sendUpdatedPasswordMail,
);
router.put(
  "/OTP/reset-password",
  ValidateOTP,
  Validate,
  validateResetOTP,
  resetUserPassword,
  sendUpdatedPasswordMail,
);

router.get("/youtube/connect", verifyUserLoginToken, getYouTubeAuthUrl);
router.get("/facebook/connect", verifyUserLoginToken, getFacebookAuthUrl);

// OAuth Callback Routes (Redirected from Provider)
router.get("/youtube/callback", youtubeCallback);
router.get("/facebook/callback", facebookCallback);
export default router;
