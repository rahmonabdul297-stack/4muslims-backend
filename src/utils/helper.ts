import type { NextFunction, Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import type {
  CustomTokenPayload,
  TokenPayloadTypes,
} from "../types/auth.types.ts";
import { User } from "../models/User.ts";
import reshaper from "arabic-persian-reshaper";
import bidiFactory from "bidi-js";
const JWT_USER_SECRET = process.env.JWT_USER_SECRET;
export const sendSuccessResponse = (
  res: Response,
  message: string,
  data?: any,
  count?: number,
) => {
  return res.status(200).json({
    success: true,
    message: message,
    data: data,
    count: count,
  });
};

export const sendErrorResponse = (
  res: Response,
  message: string,
  status = 400,
) => {
  return res.status(status).json({
    success: false,
    message: message,
  });
};

export const CheckSession = async (req: Request, res: Response) => {
  const cookie = req.headers.cookie;
  if (!cookie) {
    return sendErrorResponse(res, "no session cookie found!");
  }
  return sendSuccessResponse(res, "session found!");
};
export const verifyUserLoginToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
      return sendErrorResponse(
        res,
        "no cookies, you're not authenticated",
        401,
      );
    }

    const cookies = Object.fromEntries(
      cookieHeader.split("; ").map((c) => {
        const [key, ...val] = c.split("=");
        return [key, val.join("=")];
      }),
    );

    const accessTokenKey = Object.keys(cookies).find(
      (key) => key !== "refreshToken",
    );
    const token = accessTokenKey ? cookies[accessTokenKey] : null;

    if (!token) {
      return sendErrorResponse(
        res,
        "no session token, You're not authenticated!",
        401,
      );
    }

    const user = jwt.verify(
      token,
      (process.env.JWT_USER_SECRET || JWT_USER_SECRET) as string,
    ) as TokenPayloadTypes;

    (req as any).id = user.id;
    req.headers.cookie = cookieHeader;
    next();
  } catch (error) {
    console.error("Access Token Verification Error:", (error as Error).message);
    return sendErrorResponse(
      res,
      "Access token expired or invalid. Please refresh.",
      401,
    );
  }
};
//refreshSession
export const refreshSession = async (req: Request, res: Response) => {
  try {
    let oldRefreshToken = req.cookies?.refreshToken;

    if (!oldRefreshToken && req.headers.cookie) {
      const match = req.headers.cookie.match(
        new RegExp("(^| )refreshToken=([^;]+)"),
      );
      if (match) {
        oldRefreshToken = match[2];
      }
    }

    if (!oldRefreshToken) {
      return sendErrorResponse(
        res,
        "Access Denied: No refresh token provided.",
        401,
      );
    }

    let decoded: CustomTokenPayload;
    try {
      decoded = jwt.verify(
        oldRefreshToken,
        process.env.REFRESH_TOKEN_SECRET as string,
      ) as CustomTokenPayload;
    } catch (jwtError) {
      console.log("JWT Verification failed. Token sent was:", oldRefreshToken);
      return sendErrorResponse(
        res,
        "Session expired. Please sign in again.",
        401,
      );
    }

    // 1. Double-check user still exists in DB
    const user = await User.findById(decoded.id);
    if (!user) {
      return sendErrorResponse(
        res,
        "User no longer exists. Please sign in again.",
        401,
      );
    }

    // 2. Cookie configuration helper
    const isProduction = process.env.NODE_ENV === "production";

    // 3. Generate new Access Token (15 min)
    const newAccessToken = jwt.sign(
      { id: user._id },
      process.env.JWT_USER_SECRET as string,
      { expiresIn: "15m" },
    );

    res.cookie("accessToken", newAccessToken, {
      path: "/",
      expires: new Date(Date.now() + 1000 * 60 * 15), // 15 mins
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction, // <-- Fixed: Only true in production!
    });

    // 4. Generate new extended Refresh Token (7 days)
    const cookieMaxAge = 1000 * 60 * 60 * 24 * 7; // 7 days
    const newRefreshToken = jwt.sign(
      { id: user._id, sessionType: "extended" },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: "7d" },
    );

    res.cookie("refreshToken", newRefreshToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction, // <-- Fixed: Only true in production!
      expires: new Date(Date.now() + cookieMaxAge), // Rolling 7-day extension!
    });

    return sendSuccessResponse(res, "Session tokens successfully renewed!", {
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error("Critical Refresh Error:", (error as Error).message);
    return sendErrorResponse(res, "An unexpected error occurred.", 500);
  }
};

// Generate alphanumeric token
export const CreatedRandomBytes = () =>
  new Promise((resolve, reject) => {
    crypto.randomBytes(6, (err, buff) => {
      if (err) reject(err);
      const token = buff.toString("hex");
      resolve(token);
    });
  });

// Generate numeric token
export const createNumericOTP = () =>
  new Promise((resolve, reject) => {
    // Generate a secure integer between 100,000 (inclusive) and 1,000,000 (exclusive)
    crypto.randomInt(100000, 1000000, (err, n) => {
      if (err) return reject(err);

      const OTP = n.toString(); // Convert the 6-digit number to a string
      resolve(OTP);
    });
  });

const bidi = bidiFactory();

export const shapeArabicText = (text: string): string => {
  if (!text) return "";

  // 1. Join isolated Arabic characters into connected cursive forms
  const joinedText = reshaper.ArabicShaper.convertArabic(text);

  return joinedText
    .split("\n")
    .map((line) => line.split("").reverse().join(""))
    .join("\n");
};

export const requirePremium = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = (req as any).id;
    if (!user) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User authentication required.",
      });
      return;
    }

    if (user.isPremium === false) {
      res.status(403).json({
        success: false,
        message: "Forbidden: This feature requires a Premium subscription.",
      });
      return;
    }

    if (user.premiumExpiresAt && new Date(user.premiumExpiresAt) < new Date()) {
      user.isPremium = false;
      await user.save();

      res.status(403).json({
        success: false,
        message: "Forbidden: Your Premium subscription has expired.",
      });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};
