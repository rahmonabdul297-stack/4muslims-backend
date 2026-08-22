"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidateOTP = exports.ValidatePasswordReset = exports.ValidatePhone = exports.ValidatePassword = exports.ValidateLoginDetails = exports.ValidateNewUserDetails = void 0;
const express_validator_1 = require("express-validator");
const ValidateNewUserDetails = [
    (0, express_validator_1.body)("name").isLength({ min: 3 }).withMessage("name is missing!"),
    (0, express_validator_1.body)("email").isEmail().withMessage("email is missing!"),
];
exports.ValidateNewUserDetails = ValidateNewUserDetails;
const ValidateLoginDetails = [
    (0, express_validator_1.body)("email").isEmail().withMessage("Enter valid email!"),
    (0, express_validator_1.body)("password")
        .isLength({ min: 8 })
        .withMessage("Enter valid username or email!"),
];
exports.ValidateLoginDetails = ValidateLoginDetails;
const ValidatePassword = [
    (0, express_validator_1.body)("email").isEmail().withMessage("Enter valid email!"),
];
exports.ValidatePassword = ValidatePassword;
const ValidatePhone = [
    (0, express_validator_1.body)("phone")
        .isLength({ min: 5, max: 15 })
        .withMessage("Invalid phone number!"),
];
exports.ValidatePhone = ValidatePhone;
const ValidatePasswordReset = [
    (0, express_validator_1.body)("password")
        .isLength({ min: 8 })
        .withMessage("The password must be at least 8 chracter"),
];
exports.ValidatePasswordReset = ValidatePasswordReset;
const ValidateOTP = [
    (0, express_validator_1.body)("OTP")
        .isLength({ min: 6, max: 6 })
        .withMessage("The OTP must be 6 character"),
];
exports.ValidateOTP = ValidateOTP;
//# sourceMappingURL=Validators.js.map