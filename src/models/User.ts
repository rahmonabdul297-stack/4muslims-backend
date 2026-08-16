import { Schema, model, Document } from "mongoose";

export type PlanType = "FREE" | "PRO" | "ULTIMATE";
export type SubscriptionStatus = "active" | "inactive" | "cancelled" | "expired";

export interface MonthlyUsage {
  videosGenerated: number;
  lastResetDate: Date;
}

export interface SocialProfiles {
  youtube?: string;
  tiktok?: string;
  facebook?: string;
}

export interface UserTypes extends Document {
  name: string;
  email: string;
  password?: string;
  profileImage?: string;
  authProvider: "google" | "apple" | "email";
  currentPeriodEnd?: Date | null;
  subscriptionStatus?: SubscriptionStatus;
  monthlyRenderCount: number; // Added to resolve property errors
  customerPaymentId?: string;
  plan: PlanType;
  isVerified: boolean;
  premiumExpiresAt?: Date | null;
  monthlyUsage: MonthlyUsage;
  socialProfiles: SocialProfiles;
  socialTokens?: {
    youtube?: {
      accessToken?: string | null;
      refreshToken?: string | null;
    };
    tiktok?: {
      accessToken?: string | null;
      refreshToken?: string | null;
    };
    facebook?: {
      accessToken?: string | null;
      pageId?: string | null;
    };
  };
  autoPostSettings?: {
    enabled: boolean;
    postFrequency: "daily" | "weekly";
    platforms: ("youtube" | "tiktok" | "facebook")[];
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const userSchema = new Schema<UserTypes>(
  {
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
    monthlyRenderCount: { type: Number, default: 0 }, // Added schema field
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
    },
    socialProfiles: {
      youtube: { type: String },
      tiktok: { type: String },
      facebook: { type: String },
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
  },
  { timestamps: true }
);

export const User = model<UserTypes>("User", userSchema);