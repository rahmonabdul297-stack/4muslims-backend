import type { Request, Response } from "express";
import { User } from "../../models/User.ts";
import { sendErrorResponse, sendSuccessResponse } from "../../utils/helper.ts";

const getUserProfile = async (req: Request, res: Response) => {
  const UserID = (req as any).id;
  console.log("UserID:", UserID);
  console.log("type of UserID", typeof UserID);
  try {
    const userDetails = await User.findById(UserID);
    if (userDetails) {
      return sendSuccessResponse(res, "welcome to your profile", userDetails);
    }
  } catch (error) {
    console.log((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};

export { getUserProfile };
