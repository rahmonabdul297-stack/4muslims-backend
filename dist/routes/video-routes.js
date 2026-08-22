"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const helper_ts_1 = require("../utils/helper.ts");
const video_controller_ts_1 = require("../controllers/video.controller.ts");
const autoposter_controller_ts_1 = require("../controllers/autoposter.controller.ts");
const planguard_ts_1 = require("../middlewares/planguard.ts");
const router = (0, express_1.Router)();
// Manual video generation route
router.post("/custom", helper_ts_1.verifyUserLoginToken, (0, planguard_ts_1.enforcePlanLimits)(false), video_controller_ts_1.generateCustomVideo);
router.get("/status/:jobId", video_controller_ts_1.getVideoStatus);
router.get("/history", helper_ts_1.verifyUserLoginToken, video_controller_ts_1.generatedVideoHistory);
router.put("/autopostsettings", helper_ts_1.verifyUserLoginToken, helper_ts_1.requirePremium, autoposter_controller_ts_1.updateAutoPostSettings);
// Trigger automated post
router.post("/triggerautopost", helper_ts_1.verifyUserLoginToken, helper_ts_1.requirePremium, autoposter_controller_ts_1.triggerQuranAutoPost);
exports.default = router;
//# sourceMappingURL=video-routes.js.map