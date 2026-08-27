import { Schema, model, Document } from "mongoose";

export interface AutoPostSettings {
  enabled: boolean;
  selectedPlatform: "youtube" | "tiktok" | "facebook";
  defaultReciterId: string | null;
  postFrequency: "5_PER_MONTH" | "DAILY";
  lastAutoPostDate?: Date | null;
  monthlyAutoPostCount: number;
}

export interface UserTypes extends Document {
  name: string;
  email: string;
  password?: string;
  profileImage?: string;
  authProvider: "google" | "apple" | "email";
  currentPeriodEnd?: Date | null;
  subscriptionStatus: "active" | "inactive" | "cancelled" | "expired";
  monthlyRenderCount: number;
  customerPaymentId?: string;
  plan: "FREE" | "PRO" | "ULTIMATE";
  isVerified: boolean;
  premiumExpiresAt?: Date | null;
  monthlyUsage: {
    videosGenerated: number;
    lastResetDate: Date;
    manualGenerationsCount: number; // Added
    autoGenerationsCount: number; // Added
  };
  socialProfiles?: {
    youtube?: string;
    tiktok?: string;
    facebook?: string;
  };
  socialTokens?: {
    youtube?: {
      accessToken: string;
      refreshToken: string;
    };
    tiktok?: {
      accessToken: string;
      refreshToken: string;
    };
    facebook?: {
      accessToken: string;
      pageId: string;
      expiresAt?: Date | null;
    };
  };
  autoPostSettings: AutoPostSettings;
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
        expiresAt: { type: Date, default: null },
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
  },
  { timestamps: true },
);

export const User = model<UserTypes>("User", userSchema);
