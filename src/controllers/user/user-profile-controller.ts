import type { Request, Response } from "express";
import { User } from "../../models/User.ts";
import { sendErrorResponse, sendSuccessResponse } from "../../utils/helper.ts";

import fs from "fs";
import bcrypt from "bcryptjs";
import { cloudinaryDestroyer, uploadImageFromPath } from "../../cloudinary.ts";

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

    // 1. Extract body params (including socialTokens)
    const {
      name,
      email,
      password,
      socialProfiles,
      youtube,
      tiktok,
      facebook,
      socialTokens, // <--- Added socialTokens from req.body
    } = req.body;

    if (name) user.name = name;
    if (email) user.email = email.toLowerCase();
    if (password) {
      const salt = bcrypt.genSaltSync(10);
      user.password = bcrypt.hashSync(password, salt);
    }

    // Initialize nested objects if they don't exist yet
    if (!user.socialProfiles) {
      user.socialProfiles = { youtube: "", tiktok: "", facebook: "" };
    }
    if (!user.socialTokens) {
      user.socialTokens = {
        facebook: { accessToken: "", pageId: "" },
        youtube: { accessToken: "", refreshToken: "" },
        tiktok: { accessToken: "", refreshToken: "" },
      } as any;
    }

    // --- Handle Social Profiles (URLs) ---
    if (socialProfiles) {
      if (socialProfiles.youtube !== undefined)
        user.socialProfiles.youtube = socialProfiles.youtube;
      if (socialProfiles.tiktok !== undefined)
        user.socialProfiles.tiktok = socialProfiles.tiktok;
      if (socialProfiles.facebook !== undefined)
        user.socialProfiles.facebook = socialProfiles.facebook;
    }

    if (youtube !== undefined) user.socialProfiles.youtube = youtube;
    if (tiktok !== undefined) user.socialProfiles.tiktok = tiktok;
    if (facebook !== undefined) user.socialProfiles.facebook = facebook;

    // --- Handle Manual Tokens Update ---
    // Accept nested object: req.body.socialTokens.facebook = { accessToken: "...", pageId: "..." }
    if (socialTokens?.facebook) {
      if (!user.socialTokens?.facebook) {
        user.socialTokens!.facebook = { accessToken: "", pageId: "" };
      }
      if (socialTokens.facebook.accessToken !== undefined) {
        user.socialTokens!.facebook.accessToken =
          socialTokens.facebook.accessToken;
      }
      if (socialTokens.facebook.pageId !== undefined) {
        user.socialTokens!.facebook.pageId = socialTokens.facebook.pageId;
      }
    }

    // Also accept top-level fields for quick payload testing:
    // req.body.facebookAccessToken & req.body.facebookPageId
    if (
      req.body.facebookAccessToken !== undefined ||
      req.body.facebookPageId !== undefined
    ) {
      if (!user.socialTokens?.facebook) {
        user.socialTokens!.facebook = { accessToken: "", pageId: "" };
      }
      if (req.body.facebookAccessToken !== undefined) {
        user.socialTokens!.facebook.accessToken = req.body.facebookAccessToken;
      }
      if (req.body.facebookPageId !== undefined) {
        user.socialTokens!.facebook.pageId = req.body.facebookPageId;
      }
    }

    // 2. Handle File Upload (from req.file)
    const newProfilePic = req.file;

    if (newProfilePic) {
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

      try {
        const cloudinaryResponse = await uploadImageFromPath(
          newProfilePic.path,
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
      } finally {
        // Multer diskStorage leaves the file in tmp_uploads/ regardless of outcome
        await fs.promises.unlink(newProfilePic.path).catch(() => {});
      }
    }

    // 3. Save changes in MongoDB
    await user.save();

    user.password = undefined as any;

    return sendSuccessResponse(res, "Profile updated successfully!", user);
  } catch (error) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Error updating profile!",
      500,
    );
  }
};
export { getUserProfile, updateUserProfile };
