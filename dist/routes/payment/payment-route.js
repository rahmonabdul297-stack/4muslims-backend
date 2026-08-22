"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const helper_ts_1 = require("../../utils/helper.ts");
const payment_ts_1 = require("../../controllers/payments/payment.ts");
const router = (0, express_1.Router)();
// Payment Gateway
router.post("/checkout", helper_ts_1.verifyUserLoginToken, payment_ts_1.checkOut);
router.get("/verify/:reference", payment_ts_1.verifyPayment);
router.post("/webhook", payment_ts_1.handlePaystackWebhook);
exports.default = router;
//# sourceMappingURL=payment-route.js.map