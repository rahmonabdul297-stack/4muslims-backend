import type { NextFunction, Request, Response } from "express";
import { sendErrorResponse } from "../../utils/helper.ts";
import { GeneratedVideo } from "../../models/generatevideo.ts";
import { User } from "../../models/User.ts";

const GenerateVideo = async (req: Request, res: Response) => {
  const user = (req as any).id;
  const cookies = req.headers.cookie;
  if (!cookies) {
    return sendErrorResponse(res, "You're not logged in!");
  }
  const { templateId, surahNumber, ayahNumber, reciterId } = req.body;
  if (!templateId || !surahNumber || !ayahNumber || !reciterId) {
    return sendErrorResponse(
      res,
      "templateId,surahNumber,ayahNumber and reciterId are required!",
    );
  }
  try {
    const generateNewVideo = new GeneratedVideo({
      userId: user,
      templateId: templateId,
      surahNumber: surahNumber,
      ayahNumber: ayahNumber,
      reciterId: reciterId,
      status: "pending",
      progress: 0,
      outputUrl: "",
    });
  } catch (error) {
    console.log((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};
const checkAndDeductUsage = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).id;
    const user = await User.findById(userId);

    if (!user) {
      return sendErrorResponse(res, "User not found");
    }

    const now = new Date();
    if (
      user.isPremium &&
      user.premiumExpiresAt &&
      new Date(user.premiumExpiresAt) > now
    ) {
      return next();
    }
    const lastReset = user.lastUsageReset
      ? new Date(user.lastUsageReset)
      : new Date(0);
    const isNewMonth =
      now.getFullYear() > lastReset.getFullYear() ||
      now.getMonth() > lastReset.getMonth();

    if (isNewMonth) {
      user.freeUsageCount = 0;
      user.lastUsageReset = now;
    }
    if (user.freeUsageCount >= 2) {
      return sendErrorResponse(
        res,
        "You have used your 2 free monthly attempts. Upgrade to Premium for unlimited access or wait until next month!",
      );
    }
    user.freeUsageCount += 1;
    await user.save();
    next();
  } catch (error) {
    console.error("Usage Check Error:", (error as Error).message);
    return sendErrorResponse(res, "Internal server error");
  }
};
export { GenerateVideo, checkAndDeductUsage };
