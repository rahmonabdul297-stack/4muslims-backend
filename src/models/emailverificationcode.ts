import { model, Schema } from "mongoose";
import type { VerificationCodeTypes } from "../types/model-types.ts";

const VerfificationCodeSchema = new Schema<VerificationCodeTypes>({
  owner: {
    type: String,
    required: true,
  },

  token: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now(),
    expires: 600,
  },
});

export const emailVerificationCode = model<VerificationCodeTypes>(
  "emailVerificationCode",
  VerfificationCodeSchema,
);
