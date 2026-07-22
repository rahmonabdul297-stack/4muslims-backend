import { Schema } from "mongoose";
import type { IAddress } from "../types/address.types.ts";

export const AddressSchema = new Schema<IAddress>(
  {
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: "Nigeria" },
    postalCode: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
    recipientName: { type: String, trim: true },
    recipientPhone: { type: String, trim: true },
  },
  { _id: true, timestamps: false },
);
