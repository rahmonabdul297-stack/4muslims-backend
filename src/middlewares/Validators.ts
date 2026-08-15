import { body, oneOf } from "express-validator";
const ValidateNewUserDetails = [
  body("name").isLength({ min: 3 }).withMessage("name is missing!"),
  body("email").isEmail().withMessage("email is missing!"),
];

const ValidateLoginDetails = [
  body("email").isEmail().withMessage("Enter valid email!"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Enter valid username or email!"),
];
const ValidatePassword = [
  body("email").isEmail().withMessage("Enter valid email!"),
];
const ValidatePhone = [
  body("phone")
    .isLength({ min: 5, max: 15 })
    .withMessage("Invalid phone number!"),
];
const ValidatePasswordReset = [
  body("password")
    .isLength({ min: 8 })
    .withMessage("The password must be at least 8 chracter"),
];
const ValidateOTP = [
  body("OTP")
    .isLength({ min: 6, max: 6 })
    .withMessage("The OTP must be 6 character"),
];



export {
  ValidateNewUserDetails,
  ValidateLoginDetails,
  ValidatePassword,
  ValidatePhone,
  ValidatePasswordReset,
  ValidateOTP,
};
