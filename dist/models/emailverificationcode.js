"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailVerificationCode = void 0;
const mongoose_1 = require("mongoose");
const VerfificationCodeSchema = new mongoose_1.Schema({
    owner: {
        type: String,
        required: true,
    },
    token: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now(),
        expires: 600,
    },
});
exports.emailVerificationCode = (0, mongoose_1.model)("emailVerificationCode", VerfificationCodeSchema);
//# sourceMappingURL=emailverificationcode.js.map