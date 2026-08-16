import { Schema, model, Document } from "mongoose";

// 1. TypeScript Interface for Payment Document
export interface IPayment extends Document {
  userId: string;
  reference: string;
  planTier: "PRO" | "ULTIMATE";
  durationMonths: 1 | 3 | 6 | 12;
  amount: number;
  currency: "NGN";
  status: "pending" | "success" | "failed";
  createdAt?: Date;
  updatedAt?: Date;
}

// 2. Mongoose Schema
const paymentSchema = new Schema<IPayment>(
  {
    userId: {
      type: String,
      ref: "User",
      required: true,
    },
    reference: {
      type: String,
      required: true,
      unique: true,
    },
    planTier: {
      type: String,
      enum: ["PRO", "ULTIMATE"],
      default: "PRO",
      required: true,
    },
    durationMonths: {
      type: Number,
      enum: [1, 3, 6, 12],
      default: 1,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      enum: ["NGN", "USD"],
      default: "NGN",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
  },
  { timestamps: true },
);

export const Payment = model<IPayment>("Payment", paymentSchema);
