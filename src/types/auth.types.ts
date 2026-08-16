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
