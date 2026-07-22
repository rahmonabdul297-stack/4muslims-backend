import { Schema, model, Document, Types } from 'mongoose';

export interface IOrderItem {
  product: Types.ObjectId;
  title: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface IOrder extends Document {
  user: Types.ObjectId;
  items: IOrderItem[];
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode?: string | undefined;
    recipientName?: string | undefined;
    recipientPhone?: string | undefined;
  };
  totalAmount: number;
  paymentStatus: 'pending' | 'paid' | 'failed';
  orderStatus: 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentReference?: string;
  createdAt: Date;
  updatedAt: Date;
}