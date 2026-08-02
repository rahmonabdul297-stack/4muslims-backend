export interface UserTypes {
  name: String; 
  email: String; 
  password?: String; 
  profileImage?: String;
  isPremium: Boolean; 
  premiumExpiresAt: Date; 
  authProvider: "google" | "apple" | "email"; 
  isVerified: Boolean;
  customerPaymentId?: String; 
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