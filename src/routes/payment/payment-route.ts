import { Router } from "express";
import {
    handlePaystackWebhook,
  initializePayment,
  verifyPayment,
} from "../../controllers/payments/payment.ts";
import { verifyUsersigninToken } from "../../utils/helper.ts";

const router = Router();
// payment gateway
router.post("/initialize", verifyUsersigninToken, initializePayment);
router.get("/verify/:reference", verifyUsersigninToken, verifyPayment);
router.get("/webhook", handlePaystackWebhook);
export default router;
