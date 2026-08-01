import type { IAddress } from "./address.types.ts";

export interface UserTypes {
  name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  profileImage?: string;
  addresses?: IAddress[];
  bio?: string;
  DOB?: string;
  isVerified:boolean;
  date?: Date;
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
