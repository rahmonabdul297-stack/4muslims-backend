import type { Request, Response } from "express";
import { sendErrorResponse, sendSuccessResponse } from "../utils/helper.ts";
import { sendSMS } from "../utils/sendsms.utils.ts";

export const sendOtpSMS = async (req: Request, res: Response) => {
  const { user, OTP } = req.body;
  const to = user.phone;
  const fullName = user.name.split(" ")[0];
  const body = `Dear ${fullName}, reset your password,\n
    ${OTP}
    \n Do not share your OTP with anyone!`;
  try {
    await sendSMS(to, body);
    return sendSuccessResponse(
      res,
      "Your OTP has been sent to the provided phone number!",
      OTP,
    );
  } catch (error) {
    console.log((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};
