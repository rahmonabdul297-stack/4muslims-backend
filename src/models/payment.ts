import { model, Schema } from "mongoose";
import type { paymentTypes } from "../types/payment.type.ts";

const paymentSchema = new Schema<paymentTypes>(
  {
    userId: {
      type: String,
      ref: "User", 
      required: true,
      index: true,
    },
    reference: {
      type: String,
      required: true,
      unique: true, 
      index: true,  
    },
    plan: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "NGN",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
      required: true,
    },
    paymentMethod: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed, 
    },
  },
  { timestamps: true }
);

export const Payment = model<paymentTypes>("Payment", paymentSchema);
