import { Schema, model } from "mongoose";
import type { IProduct } from "../types/product.type.ts";

const ProductSchema = new Schema<IProduct>(
  {
    title: {
      type: String,
      required: [true, "Product title is required"],
      trim: true,
      maxlength: [120, "Title cannot exceed 120 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price must be a positive number"],
    },
    discountPrice: {
      type: Number,
      default: 0,
      validate: {
        validator: function (val: number): boolean {
          const doc = this as unknown as IProduct;
          if (!val) return true;
          return val < doc.price;
        },
        message: "Discount price ({VALUE}) must be lower than original price",
      },
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Product must belong to a category"],
      index: true, // Speeds up category filtering
    },
    stock: {
      type: Number,
      required: [true, "Stock count is required"],
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    images: [
      {
        url: { type: String, required: true },
        public_id: { type: String, required: true },
      },
    ],
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// Add index for fast text search
ProductSchema.index({ title: "text", description: "text" });

export const Product = model<IProduct>("Product", ProductSchema);
