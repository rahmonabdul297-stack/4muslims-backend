import { model, Schema } from "mongoose";
import type { signinOtpTypes } from "../types/model-types.ts";

const signinOtpSchema = new Schema<signinOtpTypes>({
  owner: {
    type: String,
    required: true,
  },

  token: {
    type: String,
  },

  OTP: {
    type: String,
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now(),
    expires: 600,
  },
});

export const signinOtp = model<signinOtpTypes>("signinOtp", signinOtpSchema);
