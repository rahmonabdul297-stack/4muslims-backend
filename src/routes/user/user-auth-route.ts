import { Router } from "express";

import { Validate } from "../../middlewares/validate.ts";

import {
  validateExistingUser,
  validateNewUser,
  validateResetPassToken,
} from "../../middlewares/user.ts";

import {
  CheckSession,
  resetUserPassword,
  signIn,
  signUp,
  userForgotPassword,
  userForgotPasswordOTP,
} from "../../controllers/user/user-auth-controller.ts";
import {
  ValidateNewUserDetails,
  ValidatePassword,
  ValidatePasswordReset,
  ValidateSigninDetails,
} from "../../middlewares/Validators.ts";
import {
  sendOtpMail,
  sendResetPasswordMail,
  sendUpdatedPasswordMail,
} from "../../services/email-services.ts";
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
);
router.get("/check-session", CheckSession);
router.post(
  "/forgot-password",
  ValidatePassword,
  Validate,
  userForgotPassword,
  sendResetPasswordMail,
);
router.post(
  "/send-otp",
  ValidatePassword,
  Validate,
  userForgotPasswordOTP,
  sendOtpMail,
);

router.put(
  "/reset-password",
  ValidatePasswordReset,
  Validate,
  validateResetPassToken,
  resetUserPassword,
  sendUpdatedPasswordMail,
);

export default router;
