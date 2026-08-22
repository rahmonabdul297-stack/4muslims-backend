"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetUserPassword = exports.userForgotPasswordOtp = exports.userForgotPassword = exports.logOut = exports.getMe = exports.Login = exports.verifyAccount = exports.Register = void 0;
const helper_ts_1 = require("../../utils/helper.ts");
const User_ts_1 = require("../../models/User.ts");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const forgotpassword_ts_1 = require("../../models/forgotpassword.ts");
const emailverificationcode_ts_1 = require("../../models/emailverificationcode.ts");
const JWT_USER_SECRET = "gdguigsgyyaihcgghs";
// register as new user
const Register = async (req, res, next) => {
    const { name, email, phone, password } = req.body;
    const salt = bcryptjs_1.default.genSaltSync(10);
    const hashPassword = bcryptjs_1.default.hashSync(password, salt);
    try {
        const SignUpNewUser = new User_ts_1.User({
            name: name,
            email: email,
            phone: phone,
            password: hashPassword,
        });
        await SignUpNewUser.save();
        const user = await User_ts_1.User.findOne({ email: email });
        if (!user) {
            return (0, helper_ts_1.sendErrorResponse)(res, "User doesn't Exist!");
        }
        const IstokenExist = await emailverificationcode_ts_1.emailVerificationCode.findOne({
            owner: user?._id.toString(),
        });
        if (IstokenExist) {
            await emailverificationcode_ts_1.emailVerificationCode.findByIdAndDelete(IstokenExist._id);
        }
        const code = await (0, helper_ts_1.createNumericOTP)();
        const veriCode = new emailverificationcode_ts_1.emailVerificationCode({
            owner: user?._id,
            token: code,
        });
        await veriCode.save();
        req.body = { user, code };
        next();
    }
    catch (error) {
        console.log(error.message);
        return (0, helper_ts_1.sendErrorResponse)(res, error.message);
    }
};
exports.Register = Register;
// verify your acc
const verifyAccount = async (req, res) => {
    const { token } = req.body;
    try {
        const isCodeExist = await emailverificationcode_ts_1.emailVerificationCode.findOne({ token: token });
        if (!isCodeExist) {
            return (0, helper_ts_1.sendErrorResponse)(res, "Invalid Code!");
        }
        const owner = isCodeExist.owner;
        const user = await User_ts_1.User.findById(owner);
        if (user) {
            user.isVerified = true;
            await user.save();
        }
        await emailverificationcode_ts_1.emailVerificationCode.findOneAndDelete({ token: token });
        return (0, helper_ts_1.sendSuccessResponse)(res, "Account Successfully created!");
    }
    catch (error) {
        console.log(error.message);
        return (0, helper_ts_1.sendErrorResponse)(res, error.message);
    }
};
exports.verifyAccount = verifyAccount;
// login into acc
const Login = async (req, res, next) => {
    const { exsitingUser, password } = req.body;
    const isPasswordMatch = bcryptjs_1.default.compareSync(password, exsitingUser.password);
    if (!isPasswordMatch) {
        return (0, helper_ts_1.sendErrorResponse)(res, "invalid email or password");
    }
    try {
        const token = jsonwebtoken_1.default.sign({ id: exsitingUser._id }, (process.env.JWT_USER_SECRET || JWT_USER_SECRET), { expiresIn: "7d" });
        res.cookie(String(exsitingUser._id), token, {
            path: "/",
            expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV !== "development",
        });
        const initialRefreshToken = jsonwebtoken_1.default.sign({ id: exsitingUser._id, sessionType: "initial" }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "15m" });
        res.cookie("refreshToken", initialRefreshToken, {
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV !== "development",
            expires: new Date(Date.now() + 1000 * 60 * 15),
        });
        req.body = { exsitingUser };
        next();
        return (0, helper_ts_1.sendSuccessResponse)(res, "successfully logged in!");
    }
    catch (error) {
        console.log(error.message);
        return (0, helper_ts_1.sendErrorResponse)(res, error.message);
    }
};
exports.Login = Login;
// get user auth
const getMe = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, helper_ts_1.sendErrorResponse)(res, "Unauthorized: No user identifier found.", 401);
        }
        const user = await User_ts_1.User.findById(userId).select("-password -__v");
        if (!user) {
            return (0, helper_ts_1.sendErrorResponse)(res, "User profile not found.", 404);
        }
        return (0, helper_ts_1.sendSuccessResponse)(res, "Authenticated user profile retrieved successfully.", { user });
    }
    catch (error) {
        console.error("Get Current User Error:", error.message);
        return (0, helper_ts_1.sendErrorResponse)(res, error.message, 500);
    }
};
exports.getMe = getMe;
// logout from the acc
const logOut = async (req, res) => {
    try {
        const userId = req.id;
        const cookieHeader = req.headers.cookie;
        if (!cookieHeader) {
            return (0, helper_ts_1.sendErrorResponse)(res, "No active session found.");
        }
        if (userId) {
            res.clearCookie(String(userId), {
                path: "/",
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV !== "development",
            });
        }
        else {
            const cookies = Object.fromEntries(cookieHeader.split("; ").map((c) => {
                const [key, ...val] = c.split("=");
                return [key, val.join("=")];
            }));
            const accessTokenKey = Object.keys(cookies).find((key) => key !== "refreshToken");
            if (accessTokenKey) {
                res.clearCookie(accessTokenKey, {
                    path: "/",
                    httpOnly: true,
                    sameSite: "lax",
                    secure: process.env.NODE_ENV !== "development",
                });
            }
        }
        res.clearCookie("refreshToken", {
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV !== "development",
        });
        return (0, helper_ts_1.sendSuccessResponse)(res, "Successfully logged out!");
    }
    catch (error) {
        console.error("Sign Out Error:", error.message);
        return (0, helper_ts_1.sendErrorResponse)(res, error.message);
    }
};
exports.logOut = logOut;
const userForgotPassword = async (req, res, next) => {
    const { email } = req.body;
    try {
        const user = await User_ts_1.User.findOne({ email: email });
        if (!user) {
            return (0, helper_ts_1.sendErrorResponse)(res, "User doesn't exist!");
        }
        const IstokenExist = await forgotpassword_ts_1.resetForgetPasswordToken.findOne({
            owner: user._id?.toString(),
        });
        if (IstokenExist) {
            await forgotpassword_ts_1.resetForgetPasswordToken.findByIdAndDelete(IstokenExist._id);
        }
        const token = await (0, helper_ts_1.CreatedRandomBytes)();
        const resetToken = new forgotpassword_ts_1.resetForgetPasswordToken({
            owner: user?._id,
            token: token,
        });
        await resetToken.save();
        req.body = { user, token };
        next();
    }
    catch (error) {
        console.log(error.message);
        return (0, helper_ts_1.sendErrorResponse)(res, error.message);
    }
};
exports.userForgotPassword = userForgotPassword;
const userForgotPasswordOtp = async (req, res, next) => {
    const { phone } = req.body;
    try {
        const user = await User_ts_1.User.findOne({ phone: phone });
        if (!user) {
            return (0, helper_ts_1.sendErrorResponse)(res, "User doesn't exist!");
        }
        const IstokenExist = await forgotpassword_ts_1.resetForgetPasswordToken.findOne({
            owner: user._id?.toString(),
        });
        if (IstokenExist) {
            await forgotpassword_ts_1.resetForgetPasswordToken.findByIdAndDelete(IstokenExist._id);
        }
        const OTP = await (0, helper_ts_1.createNumericOTP)();
        const resetToken = new forgotpassword_ts_1.resetForgetPasswordToken({
            owner: user?._id,
            OTP: OTP,
        });
        await resetToken.save();
        req.body = { user, OTP };
        next();
    }
    catch (error) {
        console.log(error.message);
        return (0, helper_ts_1.sendErrorResponse)(res, error.message);
    }
};
exports.userForgotPasswordOtp = userForgotPasswordOtp;
const resetUserPassword = async (req, res, next) => {
    const { user, password } = req.body;
    const isPasswordMatch = bcryptjs_1.default.compareSync(password, user.password);
    if (isPasswordMatch) {
        return (0, helper_ts_1.sendErrorResponse)(res, "you're not allowed to use the previous password!");
    }
    try {
        const salt = bcryptjs_1.default.genSaltSync(10);
        const hashPassword = bcryptjs_1.default.hashSync(password, salt);
        user.password = hashPassword;
        await user.save();
        await forgotpassword_ts_1.resetForgetPasswordToken.findOneAndDelete({ owner: user?._id });
        req.body = { user };
        next();
    }
    catch (error) {
        console.log(error.message);
        return (0, helper_ts_1.sendErrorResponse)(res, error.message);
    }
};
exports.resetUserPassword = resetUserPassword;
//# sourceMappingURL=user-auth-controller.js.map