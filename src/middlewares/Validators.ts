import { body } from "express-validator";

const ValidateNewUserDetails = [
  body("name").isLength({ min: 3 }).withMessage("name is missing!"),
  body("username").isLength({ min: 3 }).withMessage("username is missing!"),
  body("email").isEmail().withMessage("email is missing!"),
  body("password")
    .isLength({ min: 5, max: 15 })
    .withMessage(
      "Enter a strong password and it must be at least minimum of 5 characters!",
    ),
];

const ValidateSigninDetails = [
  body("loginId").isLength({ min: 3 }).withMessage("Enter valid username or email!"),
  body("password")
    .isLength({ min: 5, max: 15 })
    .withMessage(
      "Enter valid password",
    ),
];
const ValidatePassword = [
  body("email").isEmail().withMessage("Enter valid email!"),
];
const ValidatePasswordReset = [
  body("password").isLength({min: 8}).withMessage("The password must be at least 8 chracter"),
];

export { ValidateNewUserDetails,ValidateSigninDetails,ValidatePassword,ValidatePasswordReset };
 