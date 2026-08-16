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
  email: string;
  amountInNaira: number;
  reference: string;
  currency?: "NGN";
  plan?: string;
  callbackUrl?: string;
  metadata?: Record<string, any>;
}

export const initializePaystackTransaction = async ({
  email,
  amountInNaira,
  reference,
  currency = "NGN",
  plan,
  callbackUrl,
  metadata = {},
}: InitializePaystackParams) => {
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

export const verifyPaystackTransaction = async (reference: string) => {
  const response = await paystackClient.get(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
  return response.data.data;
};
