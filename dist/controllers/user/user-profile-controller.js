"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserProfile = exports.getUserProfile = void 0;
const User_ts_1 = require("../../models/User.ts");
const helper_ts_1 = require("../../utils/helper.ts");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const cloudinary_ts_1 = require("../../cloudinary.ts");
const getUserProfile = async (req, res) => {
    const UserID = req.id;
    try {
        const userDetails = await User_ts_1.User.findById(UserID);
        if (userDetails) {
            return (0, helper_ts_1.sendSuccessResponse)(res, "welcome to your profile", userDetails);
        }
    }
    catch (error) {
        console.log(error.message);
        return (0, helper_ts_1.sendErrorResponse)(res, error.message);
    }
};
exports.getUserProfile = getUserProfile;
const updateUserProfile = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, helper_ts_1.sendErrorResponse)(res, "You're not logged in!", 401);
        }
        const user = await User_ts_1.User.findById(userId);
        if (!user) {
            return (0, helper_ts_1.sendErrorResponse)(res, "User doesn't exist!", 404);
        }
        // 1. Extract body params (including socialTokens)
        const { name, email, password, socialProfiles, youtube, tiktok, facebook, socialTokens, // <--- Added socialTokens from req.body
         } = req.body;
        if (name)
            user.name = name;
        if (email)
            user.email = email.toLowerCase();
        if (password) {
            const salt = bcryptjs_1.default.genSaltSync(10);
            user.password = bcryptjs_1.default.hashSync(password, salt);
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
            };
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
        if (youtube !== undefined)
            user.socialProfiles.youtube = youtube;
        if (tiktok !== undefined)
            user.socialProfiles.tiktok = tiktok;
        if (facebook !== undefined)
            user.socialProfiles.facebook = facebook;
        // --- Handle Manual Tokens Update ---
        // Accept nested object: req.body.socialTokens.facebook = { accessToken: "...", pageId: "..." }
        if (socialTokens?.facebook) {
            if (!user.socialTokens?.facebook) {
                user.socialTokens.facebook = { accessToken: "", pageId: "" };
            }
            if (socialTokens.facebook.accessToken !== undefined) {
                user.socialTokens.facebook.accessToken =
                    socialTokens.facebook.accessToken;
            }
            if (socialTokens.facebook.pageId !== undefined) {
                user.socialTokens.facebook.pageId = socialTokens.facebook.pageId;
            }
        }
        // Also accept top-level fields for quick payload testing:
        // req.body.facebookAccessToken & req.body.facebookPageId
        if (req.body.facebookAccessToken !== undefined ||
            req.body.facebookPageId !== undefined) {
            if (!user.socialTokens?.facebook) {
                user.socialTokens.facebook = { accessToken: "", pageId: "" };
            }
            if (req.body.facebookAccessToken !== undefined) {
                user.socialTokens.facebook.accessToken = req.body.facebookAccessToken;
            }
            if (req.body.facebookPageId !== undefined) {
                user.socialTokens.facebook.pageId = req.body.facebookPageId;
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
                    await (0, cloudinary_ts_1.cloudinaryDestroyer)(publicId);
                    console.log(`Successfully deleted previous image asset: ${publicId}`);
                }
                catch (deleteError) {
                    console.error("Failed to delete old image from Cloudinary:", deleteError.message);
                }
            }
            const cloudinaryResponse = await (0, cloudinary_ts_1.cloudinaryUploader)(newProfilePic.buffer, "user-profiles");
            if (!cloudinaryResponse || !cloudinaryResponse.secure_url) {
                return (0, helper_ts_1.sendErrorResponse)(res, "Failed to upload image to cloud storage.", 500);
            }
            user.profileImage = cloudinaryResponse.secure_url;
        }
        // 3. Save changes in MongoDB
        await user.save();
        user.password = undefined;
        return (0, helper_ts_1.sendSuccessResponse)(res, "Profile updated successfully!", user);
    }
    catch (error) {
        return (0, helper_ts_1.sendErrorResponse)(res, error.message || "Error updating profile!", 500);
    }
};
exports.updateUserProfile = updateUserProfile;
//# sourceMappingURL=user-profile-controller.js.map