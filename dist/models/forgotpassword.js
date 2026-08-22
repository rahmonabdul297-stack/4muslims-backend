"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetForgetPasswordToken = void 0;
const mongoose_1 = require("mongoose");
const resetForgetPasswordTokenSchema = new mongoose_1.Schema({
    owner: {
        type: String,
        required: true,
    },
    token: {
        type: String,
    },
    OTP: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now(),
        expires: 600,
    },
});
exports.resetForgetPasswordToken = (0, mongoose_1.model)("resetForgetPasswordToken", resetForgetPasswordTokenSchema);
//# sourceMappingURL=forgotpassword.js.map