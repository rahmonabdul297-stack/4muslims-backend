import { model, Schema} from "mongoose";
import type { ICart, ICartItem } from "../types/cart.types.ts";


const CartItemSchema = new Schema<ICartItem>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity cannot be less than 1'],
      default: 1,
    },
    price: {
      type: Number,
      required: true,
    },
    selectedAttributes: {
      type: Map,
      of: String,
      default: {},
    },
  },
  { _id: true }
);

const CartSchema = new Schema<ICart>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    guestToken: {
      type: String,
      index: true,
    },
    items: [CartItemSchema],
    subtotal: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);
// Synchronous version (No next parameter)
CartSchema.pre('save', function () {
  this.subtotal = this.items.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );
});

export const Cart = model<ICart>('Cart', CartSchema);