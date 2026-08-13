import { Router } from "express";

import { verifyUserLoginToken } from "../../utils/helper.ts";
import { checkOut, verifyPayment } from "../../controllers/payments/payment.ts";

const router = Router();
// payment gateway
router.post("/checkout", verifyUserLoginToken, checkOut);
router.post("/verify/:reference", verifyPayment);

export default router;
