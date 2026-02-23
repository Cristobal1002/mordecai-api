const getTwilioSmsConfig = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const statusCallbackUrl = process.env.TWILIO_SMS_STATUS_CALLBACK_URL || null;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error(
      'Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_FROM_NUMBER for SMS dispatch'
    );
  }

  return { accountSid, authToken, fromNumber, statusCallbackUrl };
};

export const sendTwilioSms = async ({ to, body }) => {
  const { accountSid, authToken, fromNumber, statusCallbackUrl } =
    getTwilioSmsConfig();

  const payload = new URLSearchParams({
    To: String(to),
    From: String(fromNumber),
    Body: String(body),
  });

  if (statusCallbackUrl) {
    payload.set('StatusCallback', statusCallbackUrl);
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${accountSid}:${authToken}`
        ).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payload.toString(),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Twilio SMS failed: ${response.status} ${errorBody}`);
  }

  const json = await response.json();
  return {
    messageSid: json.sid,
    status: json.status,
    to: json.to,
    from: json.from,
  };
};

