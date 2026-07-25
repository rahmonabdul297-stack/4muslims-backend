import type { NextFunction, Request, Response } from "express";
import { sendErrorResponse, sendSuccessResponse } from "../utils/helper.ts";
import {
  OtpTemplate,
  resetPasswordTemplate,
  signinMailTemplate,
  updatedPasswordTemplate,
} from "../templates/globalEmailTemplates/auth/resetpasswordtemp.ts";
import { sendEmail } from "../utils/sendemail.utils.ts";
import { User } from "../models/User.ts";
import { sendSMS } from "../utils/sendsms.utils.ts";

export const sendResetPasswordMail = async (req: Request, res: Response) => {
  const FRONTEND_URL = process.env.FRONTEND_URL;
  const { user, token } = req.body;
  const send_to = user.email;
  const fullName = user.name.split(" ")[0];
  const link = `${FRONTEND_URL}/api/v1/auth/reset-password?token=${token}&id=${user._id.toString()}`;

  try {
    const subject = `Dear ${fullName}, reset your password`;
    const message = resetPasswordTemplate(fullName, link);
    await sendEmail({ subject, message, send_to });
    return sendSuccessResponse(
      res,
      "password reset link has been sent to the provided email!",
      user,
    );
  } catch (error) {
    console.log((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};



export const sendUpdatedPasswordMail = async (req: Request, res: Response) => {
  const { user } = req.body;
  const send_to = user.email;
  const fullName = user.name.split(" ")[0];

  try {
    const subject = `Dear ${fullName}, Your password has been  reset successfully `;
    const message = updatedPasswordTemplate(fullName);
    await sendEmail({ subject, message, send_to });
    return sendSuccessResponse(
      res,
      "successfully reset your password, Thank you!.",
      user,
    );
  } catch (error) {
    console.log((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};

export const sendSigninMail = async (req: Request, res: Response) => {
  const { exsitingUser } = req.body;
  const send_to = exsitingUser.email;
  const fullName = exsitingUser.name.split(" ")[0];
  try {
    const subject = `Dear ${fullName}, You have successfully sign-in into your Account! `;
    const message = signinMailTemplate(fullName);
    await sendEmail({ subject, message, send_to });
    return sendSuccessResponse(res, "successfully!", exsitingUser);
  } catch (error) {
    console.log((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};
