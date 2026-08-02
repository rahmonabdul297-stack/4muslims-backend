import { model, Schema } from "mongoose";
import type { resetPasswordTokenTypes } from "../types/auth.types.ts";
const resetForgetPasswordTokenSchema = new Schema<resetPasswordTokenTypes>({
  owner: {
    type: String,
    required: true,
  },
  token: {
    type: String,
  },
  OTP: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now(),
    expires: 600,
  },
});
export const resetForgetPasswordToken = model<resetPasswordTokenTypes>(
  "resetForgetPasswordToken",
  resetForgetPasswordTokenSchema,
);
