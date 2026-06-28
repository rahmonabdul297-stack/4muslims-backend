import type { NextFunction, Request, Response } from "express";
import {
  CreatedRandomBytes,
  sendErrorResponse,
  sendSuccessResponse,
} from "../../utils/helper.ts";
import { User } from "../../models/User.ts";
import bcrypt, { genSaltSync } from "bcryptjs";
import jwt from "jsonwebtoken";
import type { TokenPayloadTypes } from "../../types/model-types.ts";
import { resetForgetPasswordToken } from "../../models/forgotpassword.ts";
const JWT_USER_SECRET = "gdguigsgyyaihcgghs";

const signUp = async (req: Request, res: Response) => {
  const { name, username, email, password } = req.body;
  const salt = bcrypt.genSaltSync(10);
  const hashPassword = bcrypt.hashSync(password, salt);

  try {
    const SignUpNewUser = new User({
      name: name,
      username: username,
      email: email,
      password: hashPassword,
    });
    await SignUpNewUser.save();
    return sendSuccessResponse(res, "account successfully created!");
  } catch (error) {
    console.log((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};

const signIn = async (req: Request, res: Response) => {
  const { exsitingUser, password } = req.body;
  const isPasswordMatch = bcrypt.compareSync(password, exsitingUser.password);
  if (!isPasswordMatch) {
    return sendErrorResponse(res, "invalid email or password");
  }
  try {
    const token = jwt.sign({ id: exsitingUser._id }, JWT_USER_SECRET, {
      expiresIn: "30m",
    });

    res.cookie(String(exsitingUser._id), token, {
      path: "/",
      expires: new Date(Date.now() + 1000 * 60 * 30),
      httpOnly: true,
      sameSite: "lax",
    });

    return sendSuccessResponse(res, "successfully logged in!");
  } catch (error) {
    console.log((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};

const CheckSession = async (req: Request, res: Response) => {
  const cookie = req.headers.cookie
  if (!cookie) {
    return sendErrorResponse(res, "no session cookie found!");
  }
  return sendSuccessResponse(res, "cookie session found", cookie);
};
const verifyUsersigninToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const cookies = req.headers.cookie;
  if (!cookies) {
    return sendErrorResponse(res, "no cookies, you're not authenticated", 401);
  }
  const token = cookies.split("=")[1];
  if (!token) {
    return sendErrorResponse(
      res,
      "no session token, You're not authenticated!",
    );
  }
  const user = jwt.verify(
    token,
    JWT_USER_SECRET as string,
  ) as TokenPayloadTypes;
  console.log("user:", user);
  (req as any).id = user.id;
  next();
};
const userForgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email: email });
    if (!user) {
      return sendErrorResponse(res, "User doesn't exist!");
    }
    const IstokenExist = await resetForgetPasswordToken.findOne({
      owner: user._id?.toString(),
    });
    if (IstokenExist) {
      await resetForgetPasswordToken.findByIdAndDelete(IstokenExist._id);
    }

    const token = await CreatedRandomBytes();
    const resetToken = new resetForgetPasswordToken({
      owner: user?._id,
      token: token,
    });
    await resetToken.save();
    req.body = { user, token };
    next();
  } catch (error) {
    console.log((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};

const userForgotPasswordOTP = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email: email });
    if (!user) {
      return sendErrorResponse(res, "User doesn't exist!");
    }
    const IstokenExist = await resetForgetPasswordToken.findOne({
      owner: user._id?.toString(),
    });
    if (IstokenExist) {
      await resetForgetPasswordToken.findByIdAndDelete(IstokenExist._id);
    }

    const token = await CreatedRandomBytes();
    const resetToken = new resetForgetPasswordToken({
      owner: user?._id,
      token: token,
    });
    await resetToken.save();
    req.body = { user, token };
    next();
  } catch (error) {
    console.log((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};

const resetUserPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { user, password } = req.body;
  const isPasswordMatch = bcrypt.compareSync(password, user.password);
  if (isPasswordMatch) {
    return sendErrorResponse(
      res,
      "you're not allowed to use the previous password!",
    );
  }
  try {
    const salt = bcrypt.genSaltSync(10);
    const hashPassword = bcrypt.hashSync(password, salt);
    user.password = hashPassword;
    await user.save();
    await resetForgetPasswordToken.findOneAndDelete({ owner: user?._id });

    req.body = { user };
    next();
  } catch (error) {
    console.log((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};

export {
  signUp,
  signIn,
  CheckSession,
  verifyUsersigninToken,
  userForgotPassword,
  userForgotPasswordOTP,
  resetUserPassword,
};
