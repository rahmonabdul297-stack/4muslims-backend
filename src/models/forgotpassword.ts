import { model, Schema } from "mongoose";
import type { resetPasswordTokenTypes } from "../types/model-types.ts";
const resetForgetPasswordTokenSchema = new Schema<resetPasswordTokenTypes>({
  owner: {
    type: String,
    required: true,
  },
  token: {
    type: String,
    required: true,

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
