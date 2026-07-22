import nodemailer from "nodemailer";
import type { sendEmailType } from "../types/global-type.ts";
// import type { Options } from "nodemailer/lib/mailer";
// import SMTPTransport from "nodemailer/lib/smtp-transport/index.js";

// export const sendEmail = ({ subject, message, send_to }: sendEmailType) => {
//   const EMAIL_HOST = process.env.EMAIL_HOST;
//   const EMAIL_PORT = process.env.EMAIL_PORT ;
//   const EMAIL_USER = process.env.EMAIL_USER;
//   const EMAIL_PASS = process.env.EMAIL_PASS;
//   const transporter = nodemailer.createTransport({
//     host:EMAIL_HOST,
//     port:EMAIL_PORT,
//     secure: false,
//     auth: {
//       user:EMAIL_USER,
//       pass:EMAIL_PASS,
//     },
//     tls: {
//       rejectUnauthorized: false,
//     },
//   } as any);

//   const mailOptions: any = {
//     from:EMAIL_HOST,
//     to: send_to,
//     reply_to:EMAIL_HOST,
//     subject,
//     html: message,
//   };

//   transporter.sendMail(mailOptions, (err, result) => {
//     if (err) {
//       console.log("error -", err);
//     }
//     console.log("result:", result.messageId);
//   });
// };
export const sendEmail = async ({ subject, message, send_to }: sendEmailType) => {
  const EMAIL_HOST = process.env.EMAIL_HOST || "smtp.gmail.com";
  // Force port 465 on Render for SSL
  const EMAIL_PORT = Number(process.env.EMAIL_PORT) || 465; 
  const EMAIL_USER = process.env.EMAIL_USER;
  const EMAIL_PASS = process.env.EMAIL_PASS;

  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465, // true for 465, false for 587
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const mailOptions = {
    from: EMAIL_USER, // ✅ FIXED: Must be your email, not the host!
    to: send_to,
    replyTo: EMAIL_USER, // ✅ FIXED: Correct camelCase property name
    subject,
    html: message,
  };

  try {
    // ✅ FIXED: Using await so Render waits for the email to actually send
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully! MessageID:", info.messageId);
    return info;
  } catch (err) {
    console.error("❌ Failed to send email on Render:", err);
    throw err; // Throw error so your Express route catches it
  }
};