import axios from "axios";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const paystackClient = axios.create({
  baseURL: "https://api.paystack.co",
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
});

export interface InitializePaystackParams {
  email: String;
  amountInNaira: number;
  reference: String;
  plan?: String;
  callbackUrl?: String;
}

/**
 * Initializes a transaction with Paystack API
 */
export const initializePaystackTransaction = async ({
  email,
  amountInNaira,
  reference,
  plan,
  callbackUrl,
}: InitializePaystackParams) => {
  const response = await paystackClient.post("/transaction/initialize", {
    email,
    amount: amountInNaira * 100, // Paystack expects amount in Kobo
    reference,
    callback_url: callbackUrl,
    metadata: {
      plan,
    },
  });

  return response.data.data; // Returns { authorization_url, access_code, reference }
};