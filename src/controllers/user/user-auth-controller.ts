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
const JWT_USER_SECRET = "gdguigsgyyaihcgghs";
// register as new user
const signUp = async (req: Request, res: Response) => {
  const { name, username, email, phone, password } = req.body;
  const salt = bcrypt.genSaltSync(10);
  const hashPassword = bcrypt.hashSync(password, salt);

  try {
    const SignUpNewUser = new User({
      name: name,
      username: username,
      email: email,
      phone: phone,
      password: hashPassword,
    });
    await SignUpNewUser.save();
    return sendSuccessResponse(res, "Account successfully created!");
  } catch (error) {
    console.log((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};



// login into acc
const signIn = async (req: Request, res: Response, next: NextFunction) => {
  const { exsitingUser, password } = req.body;

  const isPasswordMatch = bcrypt.compareSync(password, exsitingUser.password);
  if (!isPasswordMatch) {
    return sendErrorResponse(res, "invalid email or password");
  }

  try {
    // 1. Generate the short-lived Access Token (15 minutes)
    // NOTE: Make sure JWT_USER_SECRET is available in your scope or use process.env.JWT_USER_SECRET
    const token = jwt.sign(
      { id: exsitingUser._id },
      (process.env.JWT_USER_SECRET || JWT_USER_SECRET) as string,
      { expiresIn: "7d" },
    );

    // 2. Set the Access Token cookie
    res.cookie(String(exsitingUser._id), token, {
      path: "/",
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV !== "development", // Fixed production security
    });

    // 3. Generate the INITIAL Refresh Token (15 minutes)
    // Fixed: changed 'exsitingUser.id' to 'exsitingUser._id' to match your MongoDB ID property
    const initialRefreshToken = jwt.sign(
      { id: exsitingUser._id, sessionType: "initial" },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: "15m" },
    );

    // 4. Set the Refresh Token cookie
    res.cookie("refreshToken", initialRefreshToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV !== "development", // Fixed production security
      expires: new Date(Date.now() + 1000 * 60 * 15), // 15 minutes cookie expiration
    });

    // 5. Pass data forward to your next middleware and send response
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
    // 1. Get the authenticated user ID attached by verifyUsersigninToken middleware
    const userId = (req as any).id;

    if (!userId) {
      return sendErrorResponse(res, "Unauthorized: No user identifier found.", 401);
    }

    // 2. Fetch user details from the database
    // .select("-password") ensures we NEVER leak the hashed password over the network!
    const user = await User.findById(userId).select("-password -__v");

    if (!user) {
      return sendErrorResponse(res, "User profile not found.", 404);
    }

    // 3. Return the sanitized user object
    return sendSuccessResponse(
      res, 
      "Authenticated user profile retrieved successfully.", 
      { user }
    );

  } catch (error) {
    console.error("Get Current User Error:", (error as Error).message);
    return sendErrorResponse(res, (error as Error).message, 500);
  }
};


// logout from the acc
 const signOut = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).id;
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
      return sendErrorResponse(res, "No active session found.");
    }
    if (userId) {
      res.clearCookie(String(userId), {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV !== "development",
      });
    } else {
     
      const cookies = Object.fromEntries(
        cookieHeader.split("; ").map((c) => {
          const [key, ...val] = c.split("=");
          return [key, val.join("=")];
        })
      );
      const accessTokenKey = Object.keys(cookies).find(key => key !== "refreshToken");
      if (accessTokenKey) {
        res.clearCookie(accessTokenKey, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV !== "development",
        });
      }
    }

  
    res.clearCookie("refreshToken", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV !== "development",
    });

    return sendSuccessResponse(res, "Successfully signed out!");
  } catch (error) {
    console.error("Sign Out Error:", (error as Error).message);
    return sendErrorResponse(res, "An unexpected error occurred during sign out.");
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
  signUp,
  signIn,
  getMe,
  signOut,
  userForgotPassword,
  userForgotPasswordOtp,
  resetUserPassword,
};
