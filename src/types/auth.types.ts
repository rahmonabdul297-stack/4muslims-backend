export type PlanType = "FREE" | "PRO" | "ULTIMATE";

export interface SocialProfiles {
  youtube?: string | null;
  tiktok?: string | null;
  facebook?: string | null;
}

export interface MonthlyUsage {
  manualGenerationsCount: number;
  autoGenerationsCount: number;
  lastResetDate: Date;
}

export interface UserTypes {
  _id?: string;
  name: string;
  email: string;
  password?: string;
  profileImage?: string;
  authProvider: "google" | "apple" | "email";
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
}

export interface TokenPayloadTypes {
  id: string;
}
export interface resetPasswordTokenTypes {
  owner: string;
  token?: string;
  OTP?: string;
  createdAt: Date;
}

export interface VerificationCodeTypes {
  owner: string;
  token?: string;
  createdAt: Date;
}
export interface CustomTokenPayload {
  id: string;
  sessionType: "initial" | "extended";
}
