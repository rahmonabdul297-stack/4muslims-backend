import twilio from "twilio";

const accountSID = process.env.TWILIO_ACC_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twiloPhoneNo = process.env.TWILIO_PHONE_NO;

const client = twilio(accountSID, authToken);
if (!accountSID || !authToken || !twiloPhoneNo) {
  throw new Error("something is missing, check your twilio config!.");
}
export const sendSMS = async (to: string, body: string) => {
  try {
    const message = await client.messages.create({
      body: body,
      from: twiloPhoneNo,
      to: to,
    });
    console.log("SMS msg:", message);
  } catch (error) {
    console.error((error as Error).message);
  }
};
