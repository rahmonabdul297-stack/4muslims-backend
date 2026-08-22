"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOtpSMS = void 0;
const helper_ts_1 = require("../utils/helper.ts");
const sendsms_utils_ts_1 = require("../utils/sendsms.utils.ts");
const sendOtpSMS = async (req, res) => {
    const { user, OTP } = req.body;
    const to = user.phone;
    const fullName = user.name.split(" ")[0];
    const body = `Dear ${fullName}, reset your password,\n
    ${OTP}
    \n Do not share your OTP with anyone!`;
    try {
        await (0, sendsms_utils_ts_1.sendSMS)(to, body);
        return (0, helper_ts_1.sendSuccessResponse)(res, "Your OTP has been sent to the provided phone number!");
    }
    catch (error) {
        console.log(error.message);
        return (0, helper_ts_1.sendErrorResponse)(res, error.message);
    }
};
exports.sendOtpSMS = sendOtpSMS;
//# sourceMappingURL=otp-services.js.map