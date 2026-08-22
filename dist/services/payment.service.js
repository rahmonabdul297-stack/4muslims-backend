"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPaystackTransaction = exports.initializePaystackTransaction = void 0;
const axios_1 = __importDefault(require("axios"));
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const paystackClient = axios_1.default.create({
    baseURL: "https://api.paystack.co",
    headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
    },
});
const initializePaystackTransaction = async ({ email, amountInNaira, reference, currency = "NGN", plan, callbackUrl, metadata = {}, }) => {
    const response = await paystackClient.post("/transaction/initialize", {
        email,
        // Convert to minor subunits (Kobo for NGN, Cents for USD)
        amount: Math.round(amountInNaira * 100),
        reference,
        currency,
        callback_url: callbackUrl,
        metadata: {
            plan,
            ...metadata,
        },
    });
    return response.data.data;
};
exports.initializePaystackTransaction = initializePaystackTransaction;
const verifyPaystackTransaction = async (reference) => {
    const response = await paystackClient.get(`/transaction/verify/${encodeURIComponent(reference)}`);
    return response.data.data;
};
exports.verifyPaystackTransaction = verifyPaystackTransaction;
//# sourceMappingURL=payment.service.js.map