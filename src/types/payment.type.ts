export interface paymentTypes {
  userId: String;
  reference: string;
  plan: "monthly" | "yearly";
  amount: number;
  currency: string;
  status: "pending" | "success" | "failed";
  paymentMethod?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
