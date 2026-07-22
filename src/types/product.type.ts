import type { Document, Schema } from "mongoose";

export interface IProduct extends Document {
  title: string;
  slug: string;
  description: string;
  price: number;
  discountPrice?: number;
  category: Schema.Types.ObjectId;
  stock: number;
  images: Array<{
    url: string;
    public_id: string;
  }>;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}