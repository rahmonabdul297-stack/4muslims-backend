import { Router } from "express";

import { verifyUserLoginToken } from "../../utils/helper.ts";
import { checkOut } from "../../controllers/payments/payment.ts";

const router = Router();
// payment gateway
router.post("/checkout", verifyUserLoginToken, checkOut);

export default router;
