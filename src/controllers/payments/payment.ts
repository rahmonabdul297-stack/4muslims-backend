import type { Request, Response } from "express";
import { sendErrorResponse } from "../../utils/helper.ts";
import { User } from "../../models/User.ts";

const checkOut = async (req: Request, res: Response) => {
  const userId = (req as any).message;
  if (!userId) {
    return sendErrorResponse(res, "You're not authenticated!");
  }
  try {
    const user = await User.findById(userId);
    if (!user) {
      return sendErrorResponse(res, "user doesn't exist!");
    }
    if (user.isPremium === true) {
      return sendErrorResponse(res, "This account has been upgraded!");
    }
    
  } catch (error) {
    console.log((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};
