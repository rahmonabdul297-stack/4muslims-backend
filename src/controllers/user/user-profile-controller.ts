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

    // 1. Handle Text Fields & Social Profiles (from req.body)
    const { name, email, password, socialProfiles, youtube, tiktok, facebook } =
      req.body;

    if (name) user.name = name;
    if (email) user.email = email.toLowerCase();
    if (password) {
      const salt = bcrypt.genSaltSync(10);
      user.password = bcrypt.hashSync(password, salt);
    }

    // Initialize socialProfiles object if it doesn't exist on user document yet
    if (!user.socialProfiles) {
      user.socialProfiles = { youtube: "", tiktok: "", facebook: "" };
    }

    // Accept nested object format: req.body.socialProfiles = { youtube: '...', ... }
    if (socialProfiles) {
      if (socialProfiles.youtube !== undefined)
        user.socialProfiles.youtube = socialProfiles.youtube;
      if (socialProfiles.tiktok !== undefined)
        user.socialProfiles.tiktok = socialProfiles.tiktok;
      if (socialProfiles.facebook !== undefined)
        user.socialProfiles.facebook = socialProfiles.facebook;
    }

    // Also accept top-level fields: req.body.youtube, req.body.tiktok, req.body.facebook
    if (youtube !== undefined) user.socialProfiles.youtube = youtube;
    if (tiktok !== undefined) user.socialProfiles.tiktok = tiktok;
    if (facebook !== undefined) user.socialProfiles.facebook = facebook;

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

    // 3. Save all changes (text + social links + image) in a single DB write
    await user.save();

    // Hide sensitive data before sending back
    user.password = undefined as any;

    return sendSuccessResponse(res, "Profile updated successfully!", user);
  } catch (error) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Error updating profile!",
    );
  }
};
export { getUserProfile, updateUserProfile };
