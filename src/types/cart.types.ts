import { Document, Types } from 'mongoose';

export interface ICartItem {
  product: Types.ObjectId;
  quantity: number;
  price: number; 
  selectedAttributes?: Record<string, string>; 
}

export interface ICart extends Document {
  user?: Types.ObjectId;
  guestToken?: string;
  items: ICartItem[];
  subtotal: number;
  updatedAt: Date;
  createdAt: Date;
}

