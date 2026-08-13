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


export const initializePaystackTransaction = async ({
  email,
  amountInNaira,
  reference,
  plan,
  callbackUrl,
}: InitializePaystackParams) => {
  const response = await paystackClient.post("/transaction/initialize", {
    email,
    amount: amountInNaira * 100, 
    reference,
    callback_url: callbackUrl,
    metadata: {
      plan,
    },
  });

  return response.data.data; 
};


export const verifyPaystackTransaction = async (reference: string) => {
  const response = await paystackClient.get(
    `/transaction/verify/${encodeURIComponent(reference)}`
  );
  return response.data.data;
};