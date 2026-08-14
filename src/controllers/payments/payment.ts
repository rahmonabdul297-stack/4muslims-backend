import type { Request, Response } from "express";
import crypto from "crypto";
import { sendErrorResponse, sendSuccessResponse } from "../../utils/helper.ts";
import { User } from "../../models/User.ts";
import { Payment } from "../../models/payment.ts";
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
} from "../../services/payment.service.ts";
const secret = process.env.PAYSTACK_SECRET_KEY;

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
      return sendSuccessResponse(
        res,
        "Payment already verified successfully.",
        {
          reference: payment.reference,
          status: payment.status,
        },
      );
    }

    const paystackData = await verifyPaystackTransaction(String(reference));

    if (paystackData && paystackData.status === "success") {
      payment.status = "success";
      payment.paymentMethod = paystackData.channel;
      await payment.save();
      const user = await User.findById(payment.userId);
      if (user) {
        const now = new Date();
        const durationInDays = payment.plan === "yearly" ? 365 : 30;

        const currentExpiry =
          user.premiumExpiresAt && new Date(user.premiumExpiresAt) > now
            ? new Date(user.premiumExpiresAt)
            : now;

        const newExpiryDate = new Date(
          currentExpiry.getTime() + durationInDays * 24 * 60 * 60 * 1000,
        );

        await User.findByIdAndUpdate(payment.userId, {
          isPremium: true,
          premiumExpiresAt: newExpiryDate,
        });
      }

      return sendSuccessResponse(
        res,
        "Payment verified successfully! Account upgraded.",
        { reference: payment.reference, status: payment.status },
      );
    } else {
      payment.status = "failed";
      await payment.save();
      return sendErrorResponse(res, "Payment failed or was declined.");
    }
  } catch (error) {
    console.error("Verification Error:", (error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};
export const paymentWebhook = async (req: Request, res: Response) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return sendErrorResponse(res, "field are required!");
    }

    // 1. Use the raw unparsed buffer for hashing if available
    const rawData = (req as any).rawBody || JSON.stringify(req.body);

    const hash = crypto
      .createHmac("sha512", String(secret))
      .update(rawData)
      .digest("hex");

    // 2. Validate signature
    if (hash !== req.headers["x-paystack-signature"]) {
      return sendErrorResponse(res, "Invalid Webhook Signature");
    }

    const { event, data } = req.body;

    if (event === "charge.success") {
      const { reference, channel } = data;

      const payment = await Payment.findOne({ reference });

      if (payment && payment.status !== "success") {
        payment.status = "success";
        payment.paymentMethod = channel;
        await payment.save();

        await User.findByIdAndUpdate(payment.userId, {
          isPremium: true,
        });

        console.log(
          `Webhook processed successfully for User ID: ${payment.userId}`,
        );
      }
    }

    return res.status(200).send("Webhook received");
  } catch (error) {
    console.error("Webhook processing error:", (error as Error).message);
    return sendErrorResponse(res, "webhook internal err-");
  }
};
