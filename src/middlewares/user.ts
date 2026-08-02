import type { NextFunction, Request, Response } from "express";
import { sendErrorResponse, sendSuccessResponse } from "../utils/helper.ts";
import { User } from "../models/User.ts";
import { resetForgetPasswordToken } from "../models/forgotpassword.ts";
import { isValidObjectId } from "mongoose";

const validateNewUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { email } = req.body;
  var ItExisting;
  try {
    ItExisting = await User.findOne({ email: email.toLowerCase() });
    if (ItExisting?.isVerified === false) {
      await User.findOneAndDelete({ email: email });
    }
    if (ItExisting && ItExisting?.isVerified === true) {
      return sendErrorResponse(
        res,
        "The email already exist, try to sign-in instead!",
      );
    }
    req.body.email = email.toLowerCase();
    next();
  } catch (error) {
    console.log((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};

const validateExistingUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { loginId, password } = req.body;
  try {
    const exsitingUser = await User.findOne({ email: loginId.toLowerCase() });
    if (!exsitingUser) {
      return sendErrorResponse(res, "invalid Email or password, Try again!");
    }
    req.body = { exsitingUser, password };
    next();
  } catch (error) {
    console.log((error as Error).message);
    return sendSuccessResponse(res, (error as Error).message);
  }
};
const validateResetPassToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { token, id } = req.query;
  if (!token || !id) {
    return sendErrorResponse(res, "invalid request!");
  }
  if (!isValidObjectId(id)) {
    return sendErrorResponse(res, "invalid ID!");
  }
  const user = await User.findById(id);
  if (!user) {
    return sendErrorResponse(res, "User doesn't exist!");
  }
  const IstokenExist = await resetForgetPasswordToken.findOne({
    owner: user?._id.toString(),
  });

  if (!IstokenExist) {
    return sendErrorResponse(res, "Token does not exist!");
  }
  const resetToken = IstokenExist.token;
  if (resetToken !== token) {
    return sendErrorResponse(res, "Token is invalid!");
  }
  req.body.user = user;
  next();
};

const validateResetOTP = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { phone, OTP } = req.body;
  if (!OTP) {
    return sendErrorResponse(res, "Enter your OTP!");
  }
  const isOtpExist = await resetForgetPasswordToken.findOne({
    OTP: OTP,
  });
  if (!isOtpExist) {
    return sendErrorResponse(res, "OTP doesn't exist!");
  }
  const user = await User.findOne({ phone: phone });
  if (!user) {
    return sendErrorResponse(res, "User doesn't exist!");
  }
  req.body.user = user;
  next();
};

export {
  validateNewUser,
  validateExistingUser,
  validateResetPassToken,
  validateResetOTP,
};
