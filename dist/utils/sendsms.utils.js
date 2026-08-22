"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSMS = void 0;
const twilio_1 = __importDefault(require("twilio"));
const accountSID = process.env.TWILIO_ACC_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twiloPhoneNo = process.env.TWILIO_PHONE_NO;
const client = (0, twilio_1.default)(accountSID, authToken);
if (!accountSID || !authToken || !twiloPhoneNo) {
    throw new Error("something is missing, check your twilio config!.");
}
const sendSMS = async (to, body) => {
    try {
        const message = await client.messages.create({
            body: body,
            from: twiloPhoneNo,
            to: to,
        });
        console.log("SMS msg:", message);
    }
    catch (error) {
        console.error(error.message);
    }
};
exports.sendSMS = sendSMS;
//# sourceMappingURL=sendsms.utils.js.map