"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePremium = exports.shapeArabicText = exports.createNumericOTP = exports.CreatedRandomBytes = exports.refreshSession = exports.verifyUserLoginToken = exports.CheckSession = exports.sendErrorResponse = exports.sendSuccessResponse = void 0;
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_ts_1 = require("../models/User.ts");
const arabic_persian_reshaper_1 = __importDefault(require("arabic-persian-reshaper"));
const bidi_js_1 = __importDefault(require("bidi-js"));
const JWT_USER_SECRET = process.env.JWT_USER_SECRET;
const sendSuccessResponse = (res, message, data, count) => {
    return res.status(200).json({
        success: true,
        message: message,
        data: data,
        count: count,
    });
};
exports.sendSuccessResponse = sendSuccessResponse;
const sendErrorResponse = (res, message, status = 400) => {
    return res.status(status).json({
        success: false,
        message: message,
    });
};
exports.sendErrorResponse = sendErrorResponse;
const CheckSession = async (req, res) => {
    const cookie = req.headers.cookie;
    if (!cookie) {
        return (0, exports.sendErrorResponse)(res, "no session cookie found!");
    }
    return (0, exports.sendSuccessResponse)(res, "session found!");
};
exports.CheckSession = CheckSession;
const verifyUserLoginToken = async (req, res, next) => {
    try {
        const cookieHeader = req.headers.cookie;
        if (!cookieHeader) {
            return (0, exports.sendErrorResponse)(res, "no cookies, you're not authenticated", 401);
        }
        const cookies = Object.fromEntries(cookieHeader.split("; ").map((c) => {
            const [key, ...val] = c.split("=");
            return [key, val.join("=")];
        }));
        const accessTokenKey = Object.keys(cookies).find((key) => key !== "refreshToken");
        const token = accessTokenKey ? cookies[accessTokenKey] : null;
        if (!token) {
            return (0, exports.sendErrorResponse)(res, "no session token, You're not authenticated!", 401);
        }
        const user = jsonwebtoken_1.default.verify(token, (process.env.JWT_USER_SECRET || JWT_USER_SECRET));
        req.id = user.id;
        req.headers.cookie = cookieHeader;
        next();
    }
    catch (error) {
        console.error("Access Token Verification Error:", error.message);
        return (0, exports.sendErrorResponse)(res, "Access token expired or invalid. Please refresh.", 401);
    }
};
exports.verifyUserLoginToken = verifyUserLoginToken;
//refreshSession
const refreshSession = async (req, res) => {
    try {
        let oldRefreshToken = req.cookies?.refreshToken;
        if (!oldRefreshToken && req.headers.cookie) {
            const match = req.headers.cookie.match(new RegExp("(^| )refreshToken=([^;]+)"));
            if (match) {
                oldRefreshToken = match[2];
            }
        }
        if (!oldRefreshToken) {
            return (0, exports.sendErrorResponse)(res, "Access Denied: No refresh token provided.", 401);
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(oldRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        }
        catch (jwtError) {
            console.log("JWT Verification failed. Token sent was:", oldRefreshToken);
            return (0, exports.sendErrorResponse)(res, "Session expired. Please sign in again.", 401);
        }
        // 1. Double-check user still exists in DB
        const user = await User_ts_1.User.findById(decoded.id);
        if (!user) {
            return (0, exports.sendErrorResponse)(res, "User no longer exists. Please sign in again.", 401);
        }
        // 2. Cookie configuration helper
        const isProduction = process.env.NODE_ENV === "production";
        // 3. Generate new Access Token (15 min)
        const newAccessToken = jsonwebtoken_1.default.sign({ id: user._id }, process.env.JWT_USER_SECRET, { expiresIn: "15m" });
        res.cookie("accessToken", newAccessToken, {
            path: "/",
            expires: new Date(Date.now() + 1000 * 60 * 15), // 15 mins
            httpOnly: true,
            sameSite: "lax",
            secure: isProduction, // <-- Fixed: Only true in production!
        });
        // 4. Generate new extended Refresh Token (7 days)
        const cookieMaxAge = 1000 * 60 * 60 * 24 * 7; // 7 days
        const newRefreshToken = jsonwebtoken_1.default.sign({ id: user._id, sessionType: "extended" }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "7d" });
        res.cookie("refreshToken", newRefreshToken, {
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            secure: isProduction, // <-- Fixed: Only true in production!
            expires: new Date(Date.now() + cookieMaxAge), // Rolling 7-day extension!
        });
        return (0, exports.sendSuccessResponse)(res, "Session tokens successfully renewed!", {
            accessToken: newAccessToken,
        });
    }
    catch (error) {
        console.error("Critical Refresh Error:", error.message);
        return (0, exports.sendErrorResponse)(res, "An unexpected error occurred.", 500);
    }
};
exports.refreshSession = refreshSession;
// Generate alphanumeric token
const CreatedRandomBytes = () => new Promise((resolve, reject) => {
    crypto_1.default.randomBytes(6, (err, buff) => {
        if (err)
            reject(err);
        const token = buff.toString("hex");
        resolve(token);
    });
});
exports.CreatedRandomBytes = CreatedRandomBytes;
// Generate numeric token
const createNumericOTP = () => new Promise((resolve, reject) => {
    // Generate a secure integer between 100,000 (inclusive) and 1,000,000 (exclusive)
    crypto_1.default.randomInt(100000, 1000000, (err, n) => {
        if (err)
            return reject(err);
        const OTP = n.toString(); // Convert the 6-digit number to a string
        resolve(OTP);
    });
});
exports.createNumericOTP = createNumericOTP;
const bidi = (0, bidi_js_1.default)();
const shapeArabicText = (text) => {
    if (!text)
        return "";
    // 1. Join isolated Arabic characters into connected cursive forms
    const joinedText = arabic_persian_reshaper_1.default.ArabicShaper.convertArabic(text);
    return joinedText
        .split("\n")
        .map((line) => line.split("").reverse().join(""))
        .join("\n");
};
exports.shapeArabicText = shapeArabicText;
const requirePremium = async (req, res, next) => {
    try {
        const user = req.id;
        if (!user) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User authentication required.",
            });
            return;
        }
        if (user.isPremium === false) {
            res.status(403).json({
                success: false,
                message: "Forbidden: This feature requires a Premium subscription.",
            });
            return;
        }
        if (user.premiumExpiresAt && new Date(user.premiumExpiresAt) < new Date()) {
            user.isPremium = false;
            await user.save();
            res.status(403).json({
                success: false,
                message: "Forbidden: Your Premium subscription has expired.",
            });
            return;
        }
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.requirePremium = requirePremium;
//# sourceMappingURL=helper.js.map