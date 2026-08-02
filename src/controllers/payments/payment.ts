import type { Request, Response, NextFunction } from "express";
import axios from "axios";
import { sendErrorResponse, sendSuccessResponse } from "../../utils/helper.ts";
import { User } from "../../models/User.ts";
import crypto from "crypto";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";

// // POST /api/v1/payments/initialize
// export const initializePayment = async (
//   req: Request,
//   res: Response,
//   next: NextFunction,
// ) => {
//   try {
//     const userId = (req as any).id;
//     const { orderId } = req.body;

//     if (typeof orderId !== "string" || !orderId) {
//       return sendErrorResponse(res, "Valid Order ID is required", 400);
//     }

//     // 1. Fetch Order and verify ownership
//     const order = await Order.findOne({ _id: orderId, user: userId });
//     if (!order) {
//       return sendErrorResponse(res, "Order not found", 404);
//     }

//     if (order.paymentStatus === "paid") {
//       return sendErrorResponse(
//         res,
//         "This order has already been paid for",
//         400,
//       );
//     }

//     // 2. Fetch User email
//     const user = await User.findById(userId);
//     if (!user || !user.email) {
//       return sendErrorResponse(res, "User email not found", 400);
//     }

//     // Paystack amounts are in kobo/cents (Multiply main currency by 100)
//     const amountInKobo = Math.round(order.totalAmount * 100);

//     // 3. Call Paystack Initialize API
//     const response = await axios.post(
//       "https://api.paystack.co/transaction/initialize",
//       {
//         email: user.email,
//         amount: amountInKobo,
//         metadata: {
//           orderId: order._id.toString(),
//           userId: userId.toString(),
//         },
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
//           "Content-Type": "application/json",
//         },
//       },
//     );

//     const { authorization_url, reference } = response.data.data;

//     // 4. Save the reference to the order
//     order.paymentReference = reference;
//     await order.save();

//     return sendSuccessResponse(res, "Payment initialized successfully", {
//       authorizationUrl: authorization_url,
//       reference,
//     });
//   } catch (error: any) {
//     console.error(
//       "Paystack Init Error:",
//       error?.response?.data || error.message,
//     );
//     return sendErrorResponse(res, "Failed to initialize payment", 500);
//   }
// };

// // GET /api/v1/payments/verify/:reference
// export const verifyPayment = async (
//   req: Request,
//   res: Response,
// ) => {
//   try {
//     const { reference } = req.params;

//     if (typeof reference !== "string" || !reference) {
//       return sendErrorResponse(res, "Transaction reference is required", 400);
//     }

//     // 1. Call Paystack Verify API
//     const response = await axios.get(
//       `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
//       {
//         headers: {
//           Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
//         },
//       },
//     );

//     const data = response.data.data;

//     if (data.status !== "success") {
//       return sendErrorResponse(
//         res,
//         "Payment verification failed or pending",
//         400,
//       );
//     }

//     const orderId = data.metadata?.orderId;
//     if (!orderId) {
//       return sendErrorResponse(
//         res,
//         "Order reference missing from transaction metadata",
//         400,
//       );
//     }

//     // 2. Update Order Status in Database
//     const order = await Order.findById(orderId);
//     if (!order) {
//       return sendErrorResponse(res, "Associated order not found", 404);
//     }

//     if (order.paymentStatus === "paid") {
//       return sendSuccessResponse(res, "Order is already marked as paid", order);
//     }

//     order.paymentStatus = "paid";
//     order.orderStatus = "processing";
//     await order.save();

//     return sendSuccessResponse(
//       res,
//       "Payment verified and order updated successfully",
//       order,
//     );
//   } catch (error: any) {
//     console.error(
//       "Paystack Verify Error:",
//       error?.response?.data || error.message,
//     );
//     return sendErrorResponse(res, "Failed to verify payment", 500);
//   }
// };

// export const handlePaystackWebhook = async (req: Request, res: Response) => {
//   try {
//     // 1. Verify that the request actually came from Paystack
//     const hash = crypto
//       .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY || "")
//       .update(JSON.stringify(req.body))
//       .digest("hex");

//     if (hash !== req.headers["x-paystack-signature"]) {
//       return res.status(400).send("Invalid signature");
//     }

//     const event = req.body;

//     // 2. Handle successful payment event
//     if (event.event === "charge.success") {
//       const orderId = event.data.metadata?.orderId;
//       if (orderId) {
//         const order = await Order.findById(orderId);
//         if (order && order.paymentStatus !== "paid") {
//           order.paymentStatus = "paid";
//           order.orderStatus = "processing";
//           await order.save();
//         }
//       }
//     }

//     // Always send a 200 OK back to Paystack quickly
//     return res.status(200).send("Webhook processed");
//   } catch (error) {
//     console.error("Webhook error:", error);
//     return res.status(500).send("Webhook handler error");
//   }
// };
