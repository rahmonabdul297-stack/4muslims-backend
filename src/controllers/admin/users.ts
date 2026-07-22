import type { Request, Response } from "express";
import { User } from "../../models/User.ts";
import { sendErrorResponse, sendSuccessResponse } from "../../utils/helper.ts";
import { isValidObjectId } from "mongoose";

 const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params; 

  if (!isValidObjectId(id)) {
    return sendErrorResponse(res, "Invalid ID format!");
  }

  try {
  
    const deletedUser = await User.findByIdAndDelete(id); 
    
    if (!deletedUser) {
      return sendErrorResponse(res, "No user found with that ID!");
    }

    return sendSuccessResponse(res, "User successfully deleted!", deletedUser);

  } catch (error) {
    console.error("Error deleting user:", error);
    // 3. Updated the error message to match the operation
    return sendErrorResponse(
      res,
      "An error occurred while deleting the user", 
      500
    );
  }
};

const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find();
    if (!users) {
      return sendErrorResponse(res, "no user found!");
    }

    return sendSuccessResponse(res, "here they are!", users);
  } catch (error) {
    return sendErrorResponse(
      res,
      "An error occurred while fetching users",
      500,
    );
  }
};

export { deleteUser, getAllUsers };
