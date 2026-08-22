"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const sendEmail = ({ subject, message, send_to }) => {
    const EMAIL_HOST = process.env.EMAIL_HOST;
    const EMAIL_PORT = process.env.EMAIL_PORT;
    const EMAIL_USER = process.env.EMAIL_USER;
    const EMAIL_PASS = process.env.EMAIL_PASS;
    const transporter = nodemailer_1.default.createTransport({
        host: EMAIL_HOST,
        port: EMAIL_PORT,
        secure: false,
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS,
        },
        tls: {
            rejectUnauthorized: true,
        },
    });
    const mailOptions = {
        from: EMAIL_HOST,
        to: send_to,
        reply_to: EMAIL_HOST,
        subject,
        html: message,
    };
    transporter.sendMail(mailOptions, (err, result) => {
        if (err) {
            console.log("error -", err);
        }
        console.log("result:", result.messageId);
    });
};
exports.sendEmail = sendEmail;
//# sourceMappingURL=sendemail.utils.js.map