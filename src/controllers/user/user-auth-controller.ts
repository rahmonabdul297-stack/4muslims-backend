import type { NextFunction, Request, Response } from "express";
import {
  CreatedRandomBytes,
  createNumericOTP,
  sendErrorResponse,
  sendSuccessResponse,
} from "../../utils/helper.ts";
import { User } from "../../models/User.ts";
import bcrypt, { genSaltSync } from "bcryptjs";
import jwt from "jsonwebtoken";
import { resetForgetPasswordToken } from "../../models/forgotpassword.ts";
import { emailVerificationCode } from "../../models/emailverificationcode.ts";
import { getAuthCookieOptions } from "../../utils/helper.ts";
const JWT_USER_SECRET = "gdguigsgyyaihcgghs";
// register as new user
const Register = async (req: Request, res: Response, next: NextFunction) => {
  const { name, email, phone, password } = req.body;
  const salt = bcrypt.genSaltSync(10);
  const hashPassword = bcrypt.hashSync(password, salt);
  try {
    const SignUpNewUser = new User({
      name: name,
      email: email,
      phone: phone,
      password: hashPassword,
    });
    await SignUpNewUser.save();
    const user = await User.findOne({ email: email });
    if (!user) {
      return sendErrorResponse(res, "User doesn't Exist!");
    }

    const IstokenExist = await emailVerificationCode.findOne({
      owner: user?._id.toString(),
    });
    if (IstokenExist) {
      await emailVerificationCode.findByIdAndDelete(IstokenExist._id);
    }
    const code = await createNumericOTP();
    const veriCode = new emailVerificationCode({
      owner: user?._id,
      token: code,
    });
    await veriCode.save();
    req.body = { user, code };
    next();
  } catch (error) {
    console.log((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};

// verify your acc
const verifyAccount = async (req: Request, res: Response) => {
  const { token } = req.body;
  try {
    const isCodeExist = await emailVerificationCode.findOne({ token: token });
    if (!isCodeExist) {
      return sendErrorResponse(res, "Invalid Code!");
    }
    const owner = isCodeExist.owner;
    const user = await User.findById(owner);
    if (user) {
      user.isVerified = true;
      await user.save();
    }
    await emailVerificationCode.findOneAndDelete({ token: token });
    return sendSuccessResponse(res, "Account Successfully created!");
  } catch (error) {
    console.log((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};

// login into acc
const Login = async (req: Request, res: Response, next: NextFunction) => {
  const { exsitingUser, password } = req.body;

  const isPasswordMatch = bcrypt.compareSync(password, exsitingUser.password);
  if (!isPasswordMatch) {
    return sendErrorResponse(res, "invalid email or password");
  }

  try {
    const token = jwt.sign(
      { id: exsitingUser._id },
      (process.env.JWT_USER_SECRET || JWT_USER_SECRET) as string,
      { expiresIn: "7d" },
    );

    res.cookie(
      String(exsitingUser._id),
      token,
      getAuthCookieOptions(new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)),
    );

    const initialRefreshToken = jwt.sign(
      { id: exsitingUser._id, sessionType: "initial" },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: "15m" },
    );

    res.cookie(
      "refreshToken",
      initialRefreshToken,
      getAuthCookieOptions(new Date(Date.now() + 1000 * 60 * 15)),
    );
    req.body = { exsitingUser };
    next();

    return sendSuccessResponse(res, "successfully logged in!");
  } catch (error) {
    console.log((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};

// get user auth
const getMe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).id;

    if (!userId) {
      return sendErrorResponse(
        res,
        "Unauthorized: No user identifier found.",
        401,
      );
    }

    const user = await User.findById(userId).select("-password -__v");

    if (!user) {
      return sendErrorResponse(res, "User profile not found.", 404);
    }

    return sendSuccessResponse(
      res,
      "Authenticated user profile retrieved successfully.",
      { user },
    );
  } catch (error) {
    console.error("Get Current User Error:", (error as Error).message);
    return sendErrorResponse(res, (error as Error).message, 500);
  }
};

// logout from the acc
const logOut = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).id;
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
      return sendErrorResponse(res, "No active session found.");
    }
    if (userId) {
      res.clearCookie(String(userId), getAuthCookieOptions());
    } else {
      const cookies = Object.fromEntries(
        cookieHeader.split("; ").map((c) => {
          const [key, ...val] = c.split("=");
          return [key, val.join("=")];
        }),
      );
      const accessTokenKey = Object.keys(cookies).find(
        (key) => key !== "refreshToken",
      );
      if (accessTokenKey) {
        res.clearCookie(accessTokenKey, getAuthCookieOptions());
      }
    }

    res.clearCookie("refreshToken", getAuthCookieOptions());

    return sendSuccessResponse(res, "Successfully logged out!");
  } catch (error) {
    console.error("Sign Out Error:", (error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
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
const userForgotPasswordOtp = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { phone } = req.body;
  try {
    const user = await User.findOne({ phone: phone });
    if (!user) {
      return sendErrorResponse(res, "User doesn't exist!");
    }
    const IstokenExist = await resetForgetPasswordToken.findOne({
      owner: user._id?.toString(),
    });
    if (IstokenExist) {
      await resetForgetPasswordToken.findByIdAndDelete(IstokenExist._id);
    }

    const OTP = await createNumericOTP();
    const resetToken = new resetForgetPasswordToken({
      owner: user?._id,
      OTP: OTP,
    });
    await resetToken.save();
    req.body = { user, OTP };
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
  Register,
  verifyAccount,
  Login,
  getMe,
  logOut,
  userForgotPassword,
  userForgotPasswordOtp,
  resetUserPassword,
};
