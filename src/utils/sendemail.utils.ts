import nodemailer from "nodemailer";
import type { sendEmailType } from "../types/global-type.ts";


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


export const sendEmail = async ({
  subject,
  message,
  send_to,
}: sendEmailType) => {
  try {
    const EMAIL_HOST = process.env.EMAIL_HOST;
    const EMAIL_PORT = Number(process.env.EMAIL_PORT);
    const EMAIL_USER = process.env.EMAIL_USER;
    const EMAIL_PASS = process.env.EMAIL_PASS;

    if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS) {
      throw new Error("Email environment variables are missing");
    }

    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });

    await transporter.verify();

    const mailOptions = {
      from: `"Your Website" <${EMAIL_USER}>`,
      to: send_to,
      replyTo: EMAIL_USER,
      subject,
      html: message,
    };

    const result = await transporter.sendMail(mailOptions);

    console.log("Email sent successfully:", result.messageId);

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    console.error("Email sending failed:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown email error",
    };
  }
};