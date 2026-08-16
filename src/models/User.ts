import { model, Schema } from "mongoose";
import type { UserTypes } from "../types/auth.types.ts";

const UserSchema = new Schema<UserTypes>({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
  },
  profileImage: {
    type: String,
  },
  authProvider: {
    type: String,
    enum: ["google", "apple", "email"],
    default: "email",
    required: true,
  },
  customerPaymentId: {
    type: String,
  },
  plan: {
    type: String,
    enum: ["FREE", "PRO", "ULTIMATE"],
    default: "FREE",
    required: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  premiumExpiresAt: {
    type: Date,
    default: null,
  },
  monthlyUsage: {
    manualGenerationsCount: {
      type: Number,
      default: 0,
    },
    autoGenerationsCount: {
      type: Number,
      default: 0,
    },
    lastResetDate: {
      type: Date,
      default: Date.now,
    },
  },
  socialProfiles: {
    youtube: { type: String, default: null },
    tiktok: { type: String, default: null },
    facebook: { type: String, default: null },
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
    postFrequency: {
      type: String,
      enum: ["daily", "weekly"],
      default: "daily",
    },
    platforms: [{ type: String, enum: ["youtube", "tiktok", "facebook"] }],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const User = model<UserTypes>("user", UserSchema);