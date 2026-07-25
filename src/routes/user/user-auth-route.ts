import { Router } from "express";

import { Validate } from "../../middlewares/validate.ts";

import {
  validateExistingUser,
  validateNewUser,
  validateResetOTP,
  validateResetPassToken,
} from "../../middlewares/user.ts";

import {
  getMe,
  resetUserPassword,
  signIn,
  signOut,
  signUp,
  userForgotPassword,
  userForgotPasswordOtp,
} from "../../controllers/user/user-auth-controller.ts";
import {
  ValidateNewUserDetails,
  ValidateOTP,
  ValidatePassword,
  ValidatePasswordReset,
  ValidatePhone,
  ValidateSigninDetails,
} from "../../middlewares/Validators.ts";
import {
  sendResetPasswordMail,
  sendSigninMail,
  sendUpdatedPasswordMail,
} from "../../services/email-services.ts";
import { sendOtpSMS } from "../../services/otp-services.ts";
import {
  CheckSession,
  refreshSession,
  verifyUsersigninToken,
} from "../../utils/helper.ts";

const router = Router();

router.post(
  "/sign-up",
  ValidateNewUserDetails,
  Validate,
  validateNewUser,
  signUp,
);
router.post(
  "/sign-in",
  ValidateSigninDetails,
  Validate,
  validateExistingUser,
  signIn,
  sendSigninMail,
);

router.post("/sign-out", verifyUsersigninToken, signOut);
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

export default router;
