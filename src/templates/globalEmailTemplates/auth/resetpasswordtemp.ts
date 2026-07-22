import { emailFooter, emailHeader } from "../headtemplate.ts";

export const resetPasswordTemplate = (fullName: string, link: string) => {
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
    <p>welcome,${fullName}!</p>
    
    To proceed with your password reset process, click the button below:
     <a href="${link}" style="display:block; background-color: green; color: aliceblue; border-radius: 5px; padding: 2px 3px; text-align: center; text-transform: capitalize;">proceed</a>
</main>
    `;

  const template = `${head}${body}${foot}`;
  return template;
};

export const OtpTemplate = (fullName: string, OTP: any) => {
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
    <p>welcome,${fullName}!</p>
    Do not share your OTP with anyone
   <div style="font-size: x-large; letter-spacing: 4px; color: #fff; font-weight: 400; text-align: center;"> ${OTP}</div>
</main>
    `;

  const template = `${head}${body}${foot}`;
  return template;
};

export const updatedPasswordTemplate = (fullName: string) => {
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
    <p>welcome,${fullName}!</p>
    
    You have successfully updated your passsword. Thanks for your time👏
    
</main>
    `;

  const template = `${head}${body}${foot}`;
  return template;
};

export const signinMailTemplate = (fullName: string) => {
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
    <p>welcome,${fullName}!</p>
    
    You have successfully sign-in into your Account. Welcome to our floor!👏
    
</main>
    `;

  const template = `${head}${body}${foot}`;
  return template;
};
