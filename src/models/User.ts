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
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const User = model<UserTypes>("user", UserSchema);
