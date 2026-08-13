import { Router } from "express";
import express from "express"
import { verifyUserLoginToken } from "../../utils/helper.ts";
import {
  checkOut,
  paystackWebhook,
  verifyPayment,
} from "../../controllers/payments/payment.ts";

const router = Router();
// Payment Gateway
router.post("/checkout", verifyUserLoginToken, checkOut);
router.get("/verify/:reference", verifyPayment);
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  paystackWebhook,
);

export default router;
