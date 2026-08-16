import type { Request, Response } from "express";
import crypto from "crypto";
import { Payment } from "../../models/payment.ts";
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
} from "../../services/payment.service.ts";
import { sendErrorResponse, sendSuccessResponse } from "../../utils/helper.ts";
import { User } from "../../models/User.ts";

// Define allowed plan tiers and duration intervals
export type PlanTier = "PRO" | "ULTIMATE";
export type PlanDuration = 1 | 3 | 6 | 12; // Months
export type Currency = "NGN";

// Base monthly prices for each plan in NGN and USD
const BASE_MONTHLY_PRICES: Record<PlanTier, Record<Currency, number>> = {
  PRO: {
    NGN: 5000,
  },
  ULTIMATE: {
    NGN: 12000, // Customize base monthly NGN price for Ultimate
  },
};
const PLAN_LIMITS: Record<PlanTier, { monthlyRenders: number }> = {
  PRO: { monthlyRenders: 30 },
  ULTIMATE: { monthlyRenders: 9999 },
};
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

    // 1. Extract parameters from body
    const {
      tier = "PRO",
      duration = 1,
      currency = "NGN",
    } = req.body as {
      tier: PlanTier;
      duration: PlanDuration;
      currency: Currency;
    };

    // 2. Validate Tier
    const selectedTier: PlanTier =
      tier?.toUpperCase() === "ULTIMATE" ? "ULTIMATE" : "PRO";

    // 3. Validate Duration (Must be 1, 3, 6, or 12 months)
    const allowedDurations: PlanDuration[] = [1, 3, 6, 12];
    const selectedDuration: PlanDuration = allowedDurations.includes(
      Number(duration) as PlanDuration,
    )
      ? (Number(duration) as PlanDuration)
      : 1;

    // 4. Validate Currency
    const selectedCurrency: Currency = "NGN";

    // 5. Calculate base monthly rate & total amount
    const baseMonthlyPrice =
      BASE_MONTHLY_PRICES[selectedTier][selectedCurrency];
    const totalAmount = baseMonthlyPrice * selectedDuration;

    // 6. Generate payment reference
    const reference = `TRX_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    // 7. Save pending payment record to DB with plan metadata
    await Payment.create({
      userId: userId,
      reference,
      planTier: selectedTier,
      durationMonths: selectedDuration,
      amount: totalAmount,
      currency: selectedCurrency,
      status: "pending",
    });

    // 8. Initialize Paystack Transaction
    // Convert USD to cents or NGN to Kobo as required by Paystack API (Amount * 100)
    const paystackData = await initializePaystackTransaction({
      email: user.email,
      amountInNaira: totalAmount,
      currency: selectedCurrency,
      reference,
      metadata: {
        userId: user.id,
        planTier: selectedTier,
        durationMonths: selectedDuration,
      },
      callbackUrl: `${process.env.FRONTEND_URL}/payment/verify?reference=${reference}`,
    });

    // 9. Return authorization URL to client
    return sendSuccessResponse(res, "Checkout initialized successfully.", {
      checkoutUrl: paystackData.authorization_url,
      reference: paystackData.reference,
      summary: {
        tier: selectedTier,
        durationMonths: selectedDuration,
        monthlyRate: baseMonthlyPrice,
        totalAmount,
        currency: selectedCurrency,
      },
    });
  } catch (error) {
    console.error("Checkout Error:", (error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};

export const verifyPayment = async (req: Request, res: Response) => {
  const { reference } = req.params;

  if (!reference) {
    return sendErrorResponse(res, "Payment reference is required!");
  }

  try {
    // 1. Fetch pending payment record from DB
    const payment = await Payment.findOne({ reference });
    if (!payment) {
      return sendErrorResponse(res, "Payment transaction record not found.");
    }

    // 2. Prevent duplicate processing if payment was already verified
    if (payment.status === "success") {
      return sendSuccessResponse(
        res,
        "Payment has already been verified and processed.",
        {
          status: payment.status,
          planTier: payment.planTier,
        },
      );
    }

    // 3. Verify transaction status with Paystack API
    const paystackData = await verifyPaystackTransaction(String(reference));

    if (paystackData.status !== "success") {
      payment.status = "failed";
      await payment.save();
      return sendErrorResponse(
        res,
        "Payment verification failed or transaction was declined.",
      );
    }

    // 4. Verify that the paid amount matches what was recorded
    const expectedSubunits = Math.round(payment.amount * 100);
    if (paystackData.amount !== expectedSubunits) {
      payment.status = "failed";
      await payment.save();
      return sendErrorResponse(res, "Payment amount mismatch detected.");
    }

    // 5. Calculate Subscription Expiration Date
    const user = await User.findById(payment.userId);
    if (!user) {
      return sendErrorResponse(res, "Associated user account not found.");
    }

    // If user already has an active future expiration date, stack the new duration onto it;
    // otherwise, start counting from current date.
    const now = new Date();
    const currentExpiration =
      user.currentPeriodEnd && new Date(user.currentPeriodEnd) > now
        ? new Date(user.currentPeriodEnd)
        : now;

    const expirationDate = new Date(currentExpiration);
    expirationDate.setMonth(expirationDate.getMonth() + payment.durationMonths);

    // 6. Update User Subscription Tier and Reset Quota
    user.plan = payment.planTier as PlanTier;
    user.subscriptionStatus = "active";
    user.currentPeriodEnd = expirationDate;
    user.monthlyRenderCount = 0; // Reset render usage count on plan activation/renewal

    await user.save();

    // 7. Update Payment status to success
    payment.status = "success";
    await payment.save();

    return sendSuccessResponse(
      res,
      "Payment verified successfully! Your plan is now active.",
      {
        planTier: user.plan,
        durationMonths: payment.durationMonths,
        expiresAt: expirationDate,
        monthlyRenderLimit: PLAN_LIMITS[user.plan as PlanTier]?.monthlyRenders,
      },
    );
  } catch (error) {
    console.error("Payment Verification Error:", (error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};


export const handlePaystackWebhook = async (req: Request, res: Response) => {
  try {
    // 1. Verify Paystack Signature
    const hash = crypto
      .createHmac("sha256", process.env.PAYSTACK_SECRET_KEY || "")
      .update(JSON.stringify(req.body))
      .digest("hex");

    const paystackSignature = req.headers["x-paystack-signature"];

    // In production, strictly enforce signature check
    if (hash !== paystackSignature) {
      return res.status(400).json({ message: "Invalid signature" });
    }

    const { event, data } = req.body;

    // 2. Handle successful payment event
    if (event === "charge.success") {
      const { userId, tier, durationMonths } = data.metadata || {};

      if (userId) {
        const monthsToAdd = Number(durationMonths) || 1;
        const currentPeriodEnd = new Date();
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + monthsToAdd);

        // Update user's plan and reset usage
        await User.findByIdAndUpdate(userId, {
          plan: tier || "PRO",
          subscriptionStatus: "active",
          currentPeriodEnd,
          monthlyRenderCount: 0,
          customerPaymentId: data.customer?.customer_code || null,
        });

        console.log(`User ${userId} upgraded to ${tier} for ${monthsToAdd} month(s).`);
      }
    }

    // Always respond with 200 OK to acknowledge receipt to Paystack
    return res.status(200).send("Webhook received successfully.");
  } catch (error: any) {
    console.error("Webhook error:", error.message);
    return res.status(500).send("Webhook processing error.");
  }
};
