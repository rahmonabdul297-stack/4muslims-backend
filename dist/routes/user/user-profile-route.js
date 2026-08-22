"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_profile_controller_ts_1 = require("../../controllers/user/user-profile-controller.ts");
const multer_ts_1 = __importDefault(require("../../multer.ts"));
const helper_ts_1 = require("../../utils/helper.ts");
const user_auth_controller_ts_1 = require("../../controllers/user/user-auth-controller.ts");
const router = (0, express_1.Router)();
router.get("/me", helper_ts_1.verifyUserLoginToken, user_auth_controller_ts_1.getMe);
router.put("/update-profile", helper_ts_1.verifyUserLoginToken, multer_ts_1.default.single("image"), user_profile_controller_ts_1.updateUserProfile);
exports.default = router;
//# sourceMappingURL=user-profile-route.js.map