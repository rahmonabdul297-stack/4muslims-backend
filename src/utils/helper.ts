import type { Response } from "express";
import crypto from "crypto";
export const sendSuccessResponse = (
  res: Response,
  message: string,
  data?: any,
) => {
  return res.status(200).json({
    success: true,
    message: message,
    data: data,
  });
};

export const sendErrorResponse = (
  res: Response,
  message: string,
  status = 400,
) => {
  return res.status(status).json({
    success: false,
    message: message,
  });
};
// Generate token
export const CreatedRandomBytes = () =>
  new Promise((resolve, reject) => {
    crypto.randomBytes(6, (err, buff) => {
      if (err) reject(err);
      const token = buff.toString("hex");
      resolve(token);
      console.log("token:", token);
    });
  });



// export const CreatedRandomBytes = () =>
//   new Promise((resolve, reject) => {
//     // Generate a secure integer between 100,000 (inclusive) and 1,000,000 (exclusive)
//     crypto.randomInt(100000, 1000000, (err, n) => {
//       if (err) return reject(err);
      
//       const token = n.toString(); // Convert the 6-digit number to a string
//       console.log("token:", token);
//       resolve(token);
//     });
//   });

