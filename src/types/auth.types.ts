export interface ISocialTokens {
  youtube?: {
    accessToken?: string | null;
    refreshToken?: string | null;
  };
  instagram?: {
    accessToken?: string | null;
    instagramAccountId?: string | null;
  };
}

export interface IAutoPostSettings {
  enabled: boolean;
  postFrequency: "daily" | "weekly";
  platforms: ("youtube" | "instagram")[];
}
export interface UserTypes {
  name: String;
  email: String;
  password?: String;
  profileImage?: String;
  isPremium: Boolean;
  premiumExpiresAt: Date;
  freeUsageCount: number;
  lastUsageReset: Date;
  authProvider: "google" | "apple" | "email";
  isVerified: Boolean;
  customerPaymentId?: String;
  socialTokens?: ISocialTokens;
  autoPostSettings?: IAutoPostSettings;
  createdAt: Date;
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
