"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = require("mongoose");
const userSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    profileImage: { type: String },
    authProvider: {
        type: String,
        enum: ["google", "apple", "email"],
        default: "email",
    },
    currentPeriodEnd: { type: Date, default: null },
    subscriptionStatus: {
        type: String,
        enum: ["active", "inactive", "cancelled", "expired"],
        default: "inactive",
    },
    monthlyRenderCount: { type: Number, default: 0 },
    customerPaymentId: { type: String },
    plan: {
        type: String,
        enum: ["FREE", "PRO", "ULTIMATE"],
        default: "FREE",
    },
    isVerified: { type: Boolean, default: false },
    premiumExpiresAt: { type: Date, default: null },
    monthlyUsage: {
        videosGenerated: { type: Number, default: 0 },
        lastResetDate: { type: Date, default: Date.now },
        manualGenerationsCount: { type: Number, default: 0 }, // Added
        autoGenerationsCount: { type: Number, default: 0 }, // Added
    },
    socialProfiles: {
        youtube: { type: String, default: "" },
        tiktok: { type: String, default: "" },
        facebook: { type: String, default: "" },
    },
    socialTokens: {
        youtube: {
            accessToken: { type: String, default: null },
            refreshToken: { type: String, default: null },
        },
        tiktok: {
            accessToken: { type: String, default: null },
            refreshToken: { type: String, default: null },
        },
        facebook: {
            accessToken: { type: String, default: null },
            pageId: { type: String, default: null },
        },
    },
    autoPostSettings: {
        enabled: { type: Boolean, default: false },
        selectedPlatform: {
            type: String,
            enum: ["youtube", "tiktok", "facebook"],
            lowercase: true,
            default: "facebook",
        },
        defaultReciterId: { type: String, default: null },
        postFrequency: {
            type: String,
            enum: ["5_PER_MONTH", "DAILY", "5_per_month", "daily"],
            uppercase: true,
            default: "5_PER_MONTH",
        },
        lastAutoPostDate: { type: Date, default: null },
        monthlyAutoPostCount: { type: Number, default: 0 },
    },
}, { timestamps: true });
exports.User = (0, mongoose_1.model)("User", userSchema);
//# sourceMappingURL=User.js.map