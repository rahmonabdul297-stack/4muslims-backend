import type { Request, Response } from "express";
import crypto from "crypto";
import { sendErrorResponse, sendSuccessResponse } from "../../utils/helper.ts";
import { User } from "../../models/User.ts";
import { Payment } from "../../models/payment.ts";
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
} from "../../services/payment.service.ts";

export const checkOut = async (req: Request, res: Response) => {
  const userId = (req as any).id;
  if (!userId) {
    return sendErrorResponse(res, "You're not authenticated!");
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return sendErrorResponse(res, "User doesn't exist!");
    }

    if (user.isPremium === true) {
      return sendErrorResponse(res, "This account has been upgraded!");
    }
    const plan: "monthly" | "yearly" =
      req.body.plan === "yearly" ? "yearly" : "monthly";
    const amount = plan === "yearly" ? 50000 : 5000;

    const reference = `TRX_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    await Payment.create({
      userId: user?.id,
      reference,
      plan,
      amount,
      currency: "NGN",
      status: "pending",
    });

    // 4. Initialize transaction with Paystack
    const paystackData = await initializePaystackTransaction({
      email: user.email,
      amountInNaira: amount,
      reference,
      plan,
      callbackUrl: `${process.env.FRONTEND_URL}/payment/verify?reference=${reference}`,
    });

    // 5. Send back authorization URL for frontend redirect

    return sendSuccessResponse(res, "Checkout initialized successfully.", {
      checkoutUrl: paystackData.authorization_url,
      reference: paystackData.reference,
    });
  } catch (error) {
    console.error("Checkout Error:", (error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};

export const verifyPayment = async (req: Request, res: Response) => {
  const { reference } = req.params;
  if (!reference) {
    return sendErrorResponse(res, "Transaction reference is required!");
  }
  try {
    const payment = await Payment.findOne({ reference });
    if (!payment) {
      return sendErrorResponse(res, "Transaction reference not found!");
    }
    if (payment.status === "success") {
      return sendSuccessResponse(res, "payment has already been verified!", {
        reference: payment.reference,
        status: payment.status,
        plan: payment.plan,
      });
    }

    const paystackData = await verifyPaystackTransaction(String(reference));

    if (paystackData && paystackData.status === "success") {
      payment.status = "success";
      payment.paymentMethod = paystackData.channel;
      payment.metadata = paystackData.metadata;
      await payment.save();
      await User.findByIdAndUpdate(payment.userId, {
        isPremium: true,
      });
    }
  } catch (error) {
    console.error((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};
