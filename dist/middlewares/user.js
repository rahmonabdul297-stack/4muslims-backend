"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateResetOTP = exports.validateResetPassToken = exports.validateExistingUser = exports.validateNewUser = void 0;
const helper_ts_1 = require("../utils/helper.ts");
const User_ts_1 = require("../models/User.ts");
const forgotpassword_ts_1 = require("../models/forgotpassword.ts");
const mongoose_1 = require("mongoose");
const validateNewUser = async (req, res, next) => {
    const { email } = req.body;
    var ItExisting;
    try {
        ItExisting = await User_ts_1.User.findOne({ email: email.toLowerCase() });
        if (ItExisting?.isVerified === false) {
            await User_ts_1.User.findOneAndDelete({ email: email });
        }
        if (ItExisting && ItExisting?.isVerified === true) {
            return (0, helper_ts_1.sendErrorResponse)(res, "The email already exist, try to sign-in instead!");
        }
        req.body.email = email.toLowerCase();
        next();
    }
    catch (error) {
        console.log(error.message);
        return (0, helper_ts_1.sendErrorResponse)(res, error.message);
    }
};
exports.validateNewUser = validateNewUser;
const validateExistingUser = async (req, res, next) => {
    const { email, password } = req.body;
    try {
        const exsitingUser = await User_ts_1.User.findOne({
            email: email.toLowerCase(),
        });
        console.log("exsitingUser:", exsitingUser);
        if (!exsitingUser) {
            return (0, helper_ts_1.sendErrorResponse)(res, "invalid Email or password, Try again!");
        }
        req.body = { exsitingUser, password };
        next();
    }
    catch (error) {
        console.log(error.message);
        return (0, helper_ts_1.sendSuccessResponse)(res, error.message);
    }
};
exports.validateExistingUser = validateExistingUser;
const validateResetPassToken = async (req, res, next) => {
    const { token, id } = req.query;
    if (!token || !id) {
        return (0, helper_ts_1.sendErrorResponse)(res, "invalid request!");
    }
    if (!(0, mongoose_1.isValidObjectId)(id)) {
        return (0, helper_ts_1.sendErrorResponse)(res, "invalid ID!");
    }
    const user = await User_ts_1.User.findById(id);
    if (!user) {
        return (0, helper_ts_1.sendErrorResponse)(res, "User doesn't exist!");
    }
    const IstokenExist = await forgotpassword_ts_1.resetForgetPasswordToken.findOne({
        owner: user?._id.toString(),
    });
    if (!IstokenExist) {
        return (0, helper_ts_1.sendErrorResponse)(res, "Token does not exist!");
    }
    const resetToken = IstokenExist.token;
    if (resetToken !== token) {
        return (0, helper_ts_1.sendErrorResponse)(res, "Token is invalid!");
    }
    req.body.user = user;
    next();
};
exports.validateResetPassToken = validateResetPassToken;
const validateResetOTP = async (req, res, next) => {
    const { phone, OTP } = req.body;
    if (!OTP) {
        return (0, helper_ts_1.sendErrorResponse)(res, "Enter your OTP!");
    }
    const isOtpExist = await forgotpassword_ts_1.resetForgetPasswordToken.findOne({
        OTP: OTP,
    });
    if (!isOtpExist) {
        return (0, helper_ts_1.sendErrorResponse)(res, "OTP doesn't exist!");
    }
    const user = await User_ts_1.User.findOne({ phone: phone });
    if (!user) {
        return (0, helper_ts_1.sendErrorResponse)(res, "User doesn't exist!");
    }
    req.body.user = user;
    next();
};
exports.validateResetOTP = validateResetOTP;
//# sourceMappingURL=user.js.map