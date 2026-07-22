import type { Request, Response } from "express";
import { User } from "../../models/User.ts";
import { sendErrorResponse, sendSuccessResponse } from "../../utils/helper.ts";

import bcrypt from "bcryptjs";
import { cloudinaryDestroyer, cloudinaryUploader } from "../../cloudinary.ts";

const getUserProfile = async (req: Request, res: Response) => {
  const UserID = (req as any).id;
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
const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).id;

    if (!userId) {
      return sendErrorResponse(res, "You're not logged in!", 401);
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendErrorResponse(res, "User doesn't exist!", 404);
    }

    // 1. Handle Text Fields (from req.body)
    const { name, username, email, phone, password, bio, DOB} = req.body;

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (bio) user.bio = bio;
    if (DOB) user.DOB = DOB;
    if (username) user.username = username.toLowerCase();
    if (email) user.email = email.toLowerCase();

    if (password) {
      const salt = bcrypt.genSaltSync(10);
      user.password = bcrypt.hashSync(password, salt);
    }

    // 2. Handle File Upload (from req.file)
    const newProfilePic = req.file;

    if (newProfilePic) {
      // Delete old image from Cloudinary if present
      if (user.profileImage && user.profileImage.includes("cloudinary.com")) {
        try {
          const urlParts = user.profileImage.split("/");
          const folderAndFileName = urlParts.slice(-2).join("/");
          const publicId = folderAndFileName.split(".")[0];
          await cloudinaryDestroyer(publicId as string);
          console.log(`Successfully deleted previous image asset: ${publicId}`);
        } catch (deleteError) {
          console.error(
            "Failed to delete old image from Cloudinary:",
            (deleteError as Error).message,
          );
        }
      }

      // Upload new image
      const cloudinaryResponse = await cloudinaryUploader(
        newProfilePic.buffer,
        "user-profiles",
      );

      if (!cloudinaryResponse || !cloudinaryResponse.secure_url) {
        return sendErrorResponse(
          res,
          "Failed to upload image to cloud storage.",
          500,
        );
      }

      user.profileImage = cloudinaryResponse.secure_url;
    }

    // 3. Save all changes (text + image) in a single DB write
    await user.save();

    // Hide sensitive data before sending back
    user.password = undefined as any;

    return sendSuccessResponse(res, "Profile updated successfully!", user);
  } catch (error) {
    console.error("Profile Update Error:", (error as Error).message);
    return sendErrorResponse(res, (error as Error).message, 500);
  }
};
export { getUserProfile, updateUserProfile };
