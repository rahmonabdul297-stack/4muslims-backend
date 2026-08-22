"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const autoposter_controller_ts_1 = require("../controllers/autoposter.controller.ts");
const User_ts_1 = require("../models/User.ts");
// Runs every day at 09:00 AM UTC
node_cron_1.default.schedule("0 9 * * *", async () => {
    console.log("Running automated daily Quran video posts...");
    const users = await User_ts_1.User.find({
        "autoPostSettings.enabled": true,
        subscriptionStatus: "active",
    });
    for (const user of users) {
        const fakeReq = { id: user._id };
        const fakeRes = {
            status: () => fakeRes,
            json: (data) => console.log(`User ${user._id} post status:`, data),
        };
        await (0, autoposter_controller_ts_1.triggerQuranAutoPost)(fakeReq, fakeRes);
    }
});
//# sourceMappingURL=autopostcron.worker.js.map