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
  isPremium: {
    type: Boolean,
    default: false,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  premiumExpiresAt: {
    type: Date,
    default: null,
  },
  freeUsageCount: {
    type: Number,
    default: 0,
  },
  lastUsageReset: {
    type: Date,
    default: Date.now,
  },
  socialTokens: {
    youtube: {
      accessToken: { type: String, default: null },
      refreshToken: { type: String, default: null },
    },
    instagram: {
      accessToken: { type: String, default: null },
      instagramAccountId: { type: String, default: null },
    },
  },

  autoPostSettings: {
    enabled: { type: Boolean, default: false },
    postFrequency: {
      type: String,
      enum: ["daily", "weekly"],
      default: "daily",
    },
    platforms: [{ type: String, enum: ["youtube", "instagram"] }],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const User = model<UserTypes>("user", UserSchema);
