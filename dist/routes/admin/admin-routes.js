"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const users_ts_1 = require("../../controllers/admin/users.ts");
const video_ts_1 = require("../../controllers/admin/video.ts");
const multer_ts_1 = __importDefault(require("../../multer.ts"));
const router = (0, express_1.Router)();
// audience
router.get("/users", users_ts_1.getAllUsers);
router.delete("/delete/:id", users_ts_1.deleteUser);
// upload multiple videos
router.post("/post-videos", multer_ts_1.default.array("videos"), video_ts_1.postVideo);
router.get("/videos", video_ts_1.getVideos);
router.delete("/video/:id", video_ts_1.deleteVideo);
exports.default = router;
//# sourceMappingURL=admin-routes.js.map