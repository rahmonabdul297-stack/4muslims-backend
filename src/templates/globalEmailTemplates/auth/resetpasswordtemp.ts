import { emailFooter, emailHeader } from "../headtemplate.ts";

export const resetPasswordTemplate = (fullName: string, link: string) => {
  const head = emailHeader();
  const foot = emailFooter();

  const body = `
   <main style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 40px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: left; box-sizing: border-box;">
  
  <!-- Reset Icon -->
  <div style="display: inline-block; background-color: #f4f4f5; border-radius: 50%; width: 48px; height: 48px; line-height: 48px; text-align: center; font-size: 22px; margin-bottom: 20px;">
    🔑
  </div>

  <!-- Heading -->
  <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; color: #111111; letter-spacing: -0.4px; line-height: 1.3;">
    Reset Your Password
  </h1>

  <!-- Body Copy -->
  <p style="margin: 0 0 24px 0; font-size: 15px; color: #555555; line-height: 1.6;">
    Hi ${fullName}, we received a request to reset the password for your account. Click the button below to choose a new one:
  </p>

  <!-- CTA Button Block -->
  <div style="margin-bottom: 28px; text-align: center;">
    <a href="${link}" style="display: inline-block; width: 100%; max-width: 280px; background-color: #000000; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 20px; border-radius: 8px; text-align: center; box-sizing: border-box;">
      Reset Password
    </a>
  </div>

  <!-- Expiration & Security Notice -->
  <div style="background-color: #f9f9f9; border-left: 3px solid #111111; padding: 12px 16px; border-radius: 4px;">
    <p style="margin: 0; font-size: 13px; color: #666666; line-height: 1.5;">
      <strong>Note:</strong> This link will expire in 15 minutes. If you didn't request a password reset, you can safely ignore this email.
    </p>
  </div>

</main>
    `;

  const template = `${head}${body}${foot}`;
  return template;
};

export const OtpTemplate = (fullName: string, OTP: any) => {
  const head = emailHeader();
  const foot = emailFooter();

  const body = `
   <main style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 40px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: left; box-sizing: border-box;">
  
  <!-- Security Icon -->
  <div style="display: inline-block; background-color: #f4f4f5; border-radius: 50%; width: 48px; height: 48px; line-height: 48px; text-align: center; font-size: 22px; margin-bottom: 20px;">
    🛡️
  </div>

  <!-- Heading -->
  <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; color: #111111; letter-spacing: -0.4px; line-height: 1.3;">
    Your Verification Code
  </h1>

  <!-- Greeting & Copy -->
  <p style="margin: 0 0 24px 0; font-size: 15px; color: #555555; line-height: 1.6;">
    Hi ${fullName}, use the one-time password (OTP) below to complete your authentication process.
  </p>

  <!-- OTP Code Box -->
  <div style="background-color: #f4f4f5; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
    <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 700; letter-spacing: 10px; color: #000000; display: inline-block;">
      ${OTP}
    </span>
  </div>

  <!-- Security Warning -->
  <div style="background-color: #fef2f2; border-left: 3px solid #ef4444; padding: 12px 16px; border-radius: 4px;">
    <p style="margin: 0; font-size: 13px; color: #991b1b; line-height: 1.5;">
      <strong>Security Alert:</strong> Never share this OTP with anyone. Our team will never ask for your code over the phone or via email.
    </p>
  </div>

</main>
    `;

  const template = `${head}${body}${foot}`;
  return template;
};

export const updatedPasswordTemplate = (fullName: string) => {
  const head = emailHeader();
  const foot = emailFooter();

  const body = `
<main style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 40px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: left; box-sizing: border-box;">
  
  <!-- Success Badge -->
  <div style="display: inline-block; background-color: #f4f4f5; border-radius: 50%; width: 48px; height: 48px; line-height: 48px; text-align: center; font-size: 22px; margin-bottom: 20px;">
    🔒
  </div>

  <!-- Heading -->
  <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; color: #111111; letter-spacing: -0.4px; line-height: 1.3;">
    Password Updated Successfully
  </h1>

  <!-- Body Text -->
  <p style="margin: 0 0 20px 0; font-size: 15px; color: #555555; line-height: 1.6;">
    Hi ${fullName}, your account password was successfully changed. You can now use your new password to sign in.
  </p>

  <!-- Security Alert Banner -->
  <div style="background-color: #f9f9f9; border-left: 3px solid #111111; padding: 14px 16px; border-radius: 4px; margin-top: 24px;">
    <p style="margin: 0; font-size: 13px; color: #666666; line-height: 1.5;">
      <strong>Didn't request this change?</strong> Please <a href="#" style="color: #111111; text-decoration: underline;">reset your password immediately</a> or contact support to secure your account.
    </p>
  </div>

</main>
    `;

  const template = `${head}${body}${foot}`;
  return template;
};

export const signinMailTemplate = (fullName: string) => {
  const head = emailHeader();
  const foot = emailFooter();

  const body = `
    <main style="max-width: 520px; margin: 0 auto; background-color: #09090b; border: 1px solid #27272a; border-radius: 12px; padding: 40px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; box-sizing: border-box; color: #ffffff;">
  
  <div style="font-size: 32px; margin-bottom: 16px;">👏</div>

  <h1 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">
    Welcome back, ${fullName}!
  </h1>

  <p style="margin: 0 0 24px 0; font-size: 15px; color: #a1a1aa; line-height: 1.6;">
    You have successfully logged in to your account. Explore your dashboard to manage your profile, security settings, and preferences.
  </p>

  <div style="padding-top: 16px; border-top: 1px solid #27272a;">
    <p style="margin: 0; font-size: 13px; color: #71717a;">
      If this login was not performed by you, please reset your password immediately.
    </p>
  </div>

</main>
    `;

  const template = `${head}${body}${foot}`;
  return template;
};

export const verifyEmailAddressMailTemplate = (VerfificationCode: string) => {
  const head = emailHeader();
  const foot = emailFooter();

  const body = `
    <main
      style="
        height: 200px;
        width: 100%;
        background-color: black;
        color: aliceblue;
      "
    >
   <div style="max-width: 480px; margin: 0 auto; padding: 40px 24px; background-color: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <!-- Title -->
  <h2 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 600; color: #111111; letter-spacing: -0.3px; line-height: 1.3;">
    Verify Your Email Address
  </h2>
  
  <!-- Subtitle -->
  <p style="margin: 0 0 28px 0; font-size: 14px; color: #666666; line-height: 1.5;">
    Use the verification code below to complete your registration.
  </p>

  <!-- Code Display Box -->
  <div style="background-color: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 8px; padding: 18px 24px; display: inline-block; width: 100%; box-sizing: border-box;">
    <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #000000; text-transform: uppercase;">
      ${VerfificationCode}
    </span>
  </div>

  <!-- Expiration Note -->
  <p style="margin: 24px 0 0 0; font-size: 12px; color: #888888;">
    This code will expire in 10 minutes. If you didn't request this, please ignore this email.
  </p>
</div>
    
</main>
    `;

  const template = `${head}${body}${foot}`;
  return template;
};
