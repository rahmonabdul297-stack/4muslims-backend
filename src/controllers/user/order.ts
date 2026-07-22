import type { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { sendErrorResponse, sendSuccessResponse } from "../../utils/helper.ts";
import { User } from "../../models/User.ts";
import { Cart } from "../../models/cart.ts";
import { Order } from "../../models/order.ts";

// POST /api/v1/orders/checkout
export const checkout = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendErrorResponse(res, errors.array()[0]!.msg, 400);
    }

    const userId = (req as any).id;
    const { cartId, addressId } = req.body; // <-- Extract cartId from request body

    // 1. Fetch User and find shipping address
    const user = await User.findById(userId);
    if (!user) {
      return sendErrorResponse(res, "User not found", 404);
    }

    const addresses = user.addresses ?? [];
    let selectedAddress = null;

    if (addressId) {
      selectedAddress = addresses.find(
        (addr: any) => addr._id.toString() === addressId,
      );
    } else {
      selectedAddress =
        addresses.find((addr: any) => addr.isDefault) || addresses[0];
    }

    if (!selectedAddress) {
      return sendErrorResponse(
        res,
        "No shipping address found. Please add an address before checkout.",
        400,
      );
    }

    // 2. Fetch Cart using cartId (populated with products)
    const cart = await Cart.findById(cartId).populate("items.product");
    if (!cart || !cart.items || cart.items.length === 0) {
      return sendErrorResponse(res, "Cart not found or is empty", 400);
    }

    // 3. Map items snapshot for order history
    const orderItems = cart.items.map((item: any) => {
      const product = item.product;
      return {
        product: product._id,
        title: product.title || product.name,
        price: product.price,
        quantity: item.quantity,
        image: product.images?.[0] || product.image || "",
      };
    });

    // 4. Extract total amount
    const totalAmount = cart.subtotal ?? 0;

    // 5. Create Order document
    const newOrder = await Order.create({
      user: userId,
      items: orderItems,
      shippingAddress: {
        street: selectedAddress.street,
        city: selectedAddress.city,
        state: selectedAddress.state,
        country: selectedAddress.country,
        postalCode: selectedAddress.postalCode || "",
        recipientName: selectedAddress.recipientName || user.name || "",
        recipientPhone: selectedAddress.recipientPhone || user.phone || "",
      },
      totalAmount,
      paymentStatus: "pending",
      orderStatus: "processing",
    });

    // 6. Clear or delete the cart
    cart.items = [] as any;
    if ("totalPrice" in cart) cart.totalPrice = 0;
    if ("subtotal" in cart) cart.subtotal = 0;
    await cart.save();

    return sendSuccessResponse(res, "Order placed successfully", newOrder);
  } catch (error) {
    next(error);
  }
};

export const getUserOrders = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).id;
    const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });

    return sendSuccessResponse(res, "Orders fetched successfully", orders);
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendErrorResponse(res, errors.array()[0]!.msg, 400);
    }

    const userId = (req as any).id;
    const { orderId } = req.params;

    // Guard clause ensures orderId is strictly a non-empty string
    if (typeof orderId !== "string" || !orderId) {
      return sendErrorResponse(res, "Invalid Order ID", 400);
    }

    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
      return sendErrorResponse(res, "Order not found", 404);
    }

    return sendSuccessResponse(
      res,
      "Order details fetched successfully",
      order,
    );
  } catch (error) {
    next(error);
  }
};

export const cancelOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendErrorResponse(res, errors.array()[0]!.msg, 400);
    }

    const userId = (req as any).id;
    const { orderId } = req.params;

    // Guard clause ensures orderId is strictly a non-empty string
    if (typeof orderId !== "string" || !orderId) {
      return sendErrorResponse(res, "Invalid Order ID", 400);
    }

    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
      return sendErrorResponse(res, "Order not found", 404);
    }

    if (order.orderStatus === "delivered" || order.orderStatus === "shipped") {
      return sendErrorResponse(
        res,
        `Cannot cancel order that has already been ${order.orderStatus}`,
        400,
      );
    }

    order.orderStatus = "cancelled";
    await order.save();

    return sendSuccessResponse(res, "Order cancelled successfully", order);
  } catch (error) {
    next(error);
  }
};
