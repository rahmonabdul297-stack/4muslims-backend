import { body, param } from "express-validator";
const ValidateNewUserDetails = [
  body("name").isLength({ min: 3 }).withMessage("name is missing!"),
  body("username").isLength({ min: 3 }).withMessage("username is missing!"),
  body("email").isEmail().withMessage("email is missing!"),
  body("phone")
    .isLength({ min: 7, max: 15 })
    .withMessage("Enter valid number!"),
  body("password")
    .isLength({ min: 5, max: 15 })
    .withMessage(
      "Enter a strong password and it must be at least minimum of 5 characters!",
    ),
];

const ValidateSigninDetails = [
  body("loginId")
    .isLength({ min: 3 })
    .withMessage("Enter valid username or email!"),
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

const validateAddToCart = [
  body("productId")
    .notEmpty()
    .withMessage("Product ID is required")
    .isMongoId()
    .withMessage("Invalid Product ID format"),

  body("quantity")
    .notEmpty()
    .withMessage("Quantity is required")
    .isInt({ min: 1 })
    .withMessage("Quantity must be an integer of at least 1"),

  body("selectedAttributes")
    .optional()
    .isObject()
    .withMessage("Selected attributes must be an object"),
];

const validateUpdateCartItem = [
  param("itemId")
    .notEmpty()
    .withMessage("Item ID is required")
    .isMongoId()
    .withMessage("Invalid Item ID format"),

  body("quantity")
    .notEmpty()
    .withMessage("Quantity is required")
    .isInt({ min: 1 })
    .withMessage("Quantity must be an integer of at least 1"),
];

const validateRemoveCartItem = [
  param("itemId")
    .notEmpty()
    .withMessage("Item ID is required")
    .isMongoId()
    .withMessage("Invalid Item ID format"),
];

const validateAddAddress = [
  body("street").trim().notEmpty().withMessage("Street address is required"),
  body("city").trim().notEmpty().withMessage("City is required"),
  body("state").trim().notEmpty().withMessage("State is required"),
  body("country").optional().trim(),
  body("postalCode").optional().trim(),
  body("isDefault").optional().isBoolean(),
  body("recipientName").optional().trim(),
  body("recipientPhone").optional().trim(),
];

const validateUpdateAddress = [
  param("addressId").isMongoId().withMessage("Invalid Address ID format"),
  body("street")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Street cannot be empty"),
  body("city").optional().trim().notEmpty().withMessage("City cannot be empty"),
  body("state")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("State cannot be empty"),
  body("country").optional().trim(),
  body("postalCode").optional().trim(),
  body("isDefault").optional().isBoolean(),
  body("recipientName").optional().trim(),
  body("recipientPhone").optional().trim(),
];

const validateAddressIdParam = [
  param("addressId").isMongoId().withMessage("Invalid Address ID format"),
];


 const validateCheckout = [
  body('cartId').isMongoId().withMessage('Valid Cart ID is required'),
  body('addressId').optional().isMongoId().withMessage('Invalid Address ID format'),
];

 const validateOrderIdParam = [
  param('orderId').isMongoId().withMessage('Invalid Order ID format'),
];
export {
  ValidateNewUserDetails,
  ValidateSigninDetails,
  ValidatePassword,
  ValidatePhone,
  ValidatePasswordReset,
  ValidateOTP,
  validateAddToCart,
  validateUpdateCartItem,
  validateRemoveCartItem,
  validateAddAddress,
  validateUpdateAddress,
  validateAddressIdParam,
  validateCheckout,
  validateOrderIdParam
};
