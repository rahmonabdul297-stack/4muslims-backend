import type { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { Cart } from "../../models/cart.ts";
import { Product } from "../../models/products.ts";

// GET /api/v1/cart
export const getCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId =(req as any)._id;

    let cart = await Cart.findOne({ user: userId }).populate(
      'items.product',
      'title images price stock'
    );

    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }

    return res.status(200).json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/cart/items
export const addToCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const userId = (req as any)._id;
    const { productId, quantity, selectedAttributes } = req.body;

    // 1. Check if product exists and has stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ success: false, message: 'Insufficient stock available' });
    }

    // 2. Fetch or create cart for this user
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    // 3. Find if item already exists in cart
    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId
    );

    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (product.stock < newQty) {
        return res.status(400).json({ success: false, message: 'Exceeds available product stock' });
      }
      existingItem.quantity = newQty;
      existingItem.price = product.price;
    } else {
      cart.items.push({
        product: product._id,
        quantity,
        price: product.price,
        selectedAttributes,
      });
    }

    await cart.save();
    await cart.populate('items.product', 'title images price stock');

    return res.status(200).json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/cart/items/:itemId
export const updateCartItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const userId =(req as any)._id;
    const { itemId } = req.params;
    const { quantity } = req.body;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    const item = cart.items.find((i) => (i as any)._id.toString() === itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found in cart' });

    const product = await Product.findById(item.product);
    if (!product || product.stock < quantity) {
      return res.status(400).json({ success: false, message: 'Requested quantity unavailable' });
    }

    item.quantity = quantity;
    item.price = product.price;

    await cart.save();
    await cart.populate('items.product', 'title images price stock');

    return res.status(200).json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/cart/items/:itemId
export const removeCartItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const userId = (req as any)._id;
    const { itemId } = req.params;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    cart.items = cart.items.filter((item) => (item as any)._id.toString() !== itemId) as any;

    await cart.save();

    return res.status(200).json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/cart
export const clearCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any)._id;
    const cart = await Cart.findOne({ user: userId });

    if (cart) {
      cart.items = [] as any;
      await cart.save();
    }

    return res.status(200).json({ success: true, message: 'Cart cleared successfully' });
  } catch (error) {
    next(error);
  }
};
