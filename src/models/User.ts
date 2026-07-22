import { model, Schema } from "mongoose";
import type { UserTypes } from "../types/model-types.ts";
import type { IAddress } from "../types/address.types.ts";
import { AddressSchema } from "./address.ts";

const UserSchema = new Schema<UserTypes>({
  name: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  profileImage: {
    type: String,
  },
  addresses: {
      type: [AddressSchema],
      default: [], // Starts as empty array for new users
    },
  bio: {
    type: String,
  },
  DOB: {
    type: String,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

export const User = model<UserTypes>("user", UserSchema);
