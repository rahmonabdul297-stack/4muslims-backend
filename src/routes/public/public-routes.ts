import { Router } from "express";
import {
  validateAddToCart,
  validateCheckout,
  validateOrderIdParam,
  validateRemoveCartItem,
  validateUpdateCartItem,
} from "../../middlewares/Validators.ts";
import {
  addToCart,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from "../../controllers/user/cart.ts";
import { verifyUsersigninToken } from "../../utils/helper.ts";
import {
  cancelOrder,
  checkout,
  getOrderById,
  getUserOrders,
} from "../../controllers/user/order.ts";

const router = Router();

router.get("/", getCart);

router.post("/items", verifyUsersigninToken, validateAddToCart, addToCart);

router.patch(
  "/items/:itemId",
  verifyUsersigninToken,
  validateUpdateCartItem,
  updateCartItem,
);
router.delete("/clear-cart", clearCart);
router.delete(
  "/items/:itemId",
  verifyUsersigninToken,
  validateRemoveCartItem,
  removeCartItem,
);

// orders
router.post("/checkout", verifyUsersigninToken, validateCheckout, checkout);
router.get("/getOrders", verifyUsersigninToken, getUserOrders);
router.get(
  "/order/:orderId",
  verifyUsersigninToken,
  validateOrderIdParam,
  getOrderById,
);
router.patch(
  "/order/:orderId/cancel",
  verifyUsersigninToken,
  validateOrderIdParam,
  cancelOrder,
);



export default router;
