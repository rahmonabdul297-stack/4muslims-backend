import { model, Schema } from "mongoose";
import type { UserTypes } from "../types/model-types.ts";

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
  password: {
    type: String,
    required: true,
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


