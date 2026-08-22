"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Payment = void 0;
const mongoose_1 = require("mongoose");
// 2. Mongoose Schema
const paymentSchema = new mongoose_1.Schema({
    userId: {
        type: String,
        ref: "User",
        required: true,
    },
    reference: {
        type: String,
        required: true,
        unique: true,
    },
    planTier: {
        type: String,
        enum: ["PRO", "ULTIMATE"],
        default: "PRO",
        required: true,
    },
    durationMonths: {
        type: Number,
        enum: [1, 3, 6, 12],
        default: 1,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        enum: ["NGN", "USD"],
        default: "NGN",
        required: true,
    },
    status: {
        type: String,
        enum: ["pending", "success", "failed"],
        default: "pending",
    },
}, { timestamps: true });
exports.Payment = (0, mongoose_1.model)("Payment", paymentSchema);
//# sourceMappingURL=payment.js.map