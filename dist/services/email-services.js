"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVerificationCode = exports.sendLoginMail = exports.sendUpdatedPasswordMail = exports.sendResetPasswordMail = void 0;
const helper_ts_1 = require("../utils/helper.ts");
const resetpasswordtemp_ts_1 = require("../templates/globalEmailTemplates/auth/resetpasswordtemp.ts");
const sendemail_utils_ts_1 = require("../utils/sendemail.utils.ts");
const sendResetPasswordMail = async (req, res) => {
    const FRONTEND_URL = process.env.FRONTEND_URL;
    const { user, token } = req.body;
    const send_to = user.email;
    const fullName = user.name.split(" ")[0];
    const link = `${FRONTEND_URL}/api/v1/auth/reset-password?token=${token}&id=${user._id.toString()}`;
    try {
        const subject = `Dear ${fullName}, reset your password`;
        const message = (0, resetpasswordtemp_ts_1.resetPasswordTemplate)(fullName, link);
        await (0, sendemail_utils_ts_1.sendEmail)({ subject, message, send_to });
        return (0, helper_ts_1.sendSuccessResponse)(res, "password reset link has been sent to the provided email!", user);
    }
    catch (error) {
        console.log(error.message);
        return (0, helper_ts_1.sendErrorResponse)(res, error.message);
    }
};
exports.sendResetPasswordMail = sendResetPasswordMail;
const sendUpdatedPasswordMail = async (req, res) => {
    const { user } = req.body;
    const send_to = user.email;
    const fullName = user.name.split(" ")[0];
    try {
        const subject = `Dear ${fullName}, Your password has been  reset successfully `;
        const message = (0, resetpasswordtemp_ts_1.updatedPasswordTemplate)(fullName);
        await (0, sendemail_utils_ts_1.sendEmail)({ subject, message, send_to });
        return (0, helper_ts_1.sendSuccessResponse)(res, "successfully reset your password, Thank you!.", user);
    }
    catch (error) {
        console.log(error.message);
        return (0, helper_ts_1.sendErrorResponse)(res, error.message);
    }
};
exports.sendUpdatedPasswordMail = sendUpdatedPasswordMail;
const sendLoginMail = async (req, res) => {
    const { exsitingUser } = req.body;
    const send_to = exsitingUser.email;
    const fullName = exsitingUser.name.split(" ")[0];
    try {
        const subject = `Dear ${fullName}, You have successfully sign-in into your Account! `;
        const message = (0, resetpasswordtemp_ts_1.signinMailTemplate)(fullName);
        await (0, sendemail_utils_ts_1.sendEmail)({ subject, message, send_to });
        return (0, helper_ts_1.sendSuccessResponse)(res, "successfully!", exsitingUser);
    }
    catch (error) {
        console.log(error.message);
        return (0, helper_ts_1.sendErrorResponse)(res, error.message);
    }
};
exports.sendLoginMail = sendLoginMail;
const sendVerificationCode = async (req, res) => {
    const { user, code } = req.body;
    const send_to = user.email;
    const VerfificationCode = code;
    try {
        const subject = `Verify your email Address`;
        const message = (0, resetpasswordtemp_ts_1.verifyEmailAddressMailTemplate)(VerfificationCode);
        await (0, sendemail_utils_ts_1.sendEmail)({ subject, message, send_to });
        return (0, helper_ts_1.sendSuccessResponse)(res, "Check your email address, verification code has been sent");
    }
    catch (error) {
        console.log(error.message);
        return (0, helper_ts_1.sendErrorResponse)(res, error.message);
    }
};
exports.sendVerificationCode = sendVerificationCode;
//# sourceMappingURL=email-services.js.map