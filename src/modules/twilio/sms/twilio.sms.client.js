import { logger } from '../../../utils/logger.js';

/**
 * Outbound SMS via Twilio Messages API.
 *
 * Link shortening (custom domain e.g. secure.mordecaitech.com): set TWILIO_SMS_SHORTEN_URLS=true
 * and TWILIO_MESSAGING_SERVICE_SID to the Messaging Service linked to your shortening domain in Twilio.
 * We still put the full pay URL in the body (PAYMENTS_BASE_URL + /p/{token}); Twilio replaces it when sending.
 *
 * @see https://www.twilio.com/docs/messaging/features/link-shortening
 */
const getTwilioSmsConfig = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim() || null;
  const messagingServiceSid =
    process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || null;
  const shortenUrls =
    process.env.TWILIO_SMS_SHORTEN_URLS === 'true' ||
    process.env.TWILIO_SMS_SHORTEN_URLS === '1';
  const statusCallbackUrl = process.env.TWILIO_SMS_STATUS_CALLBACK_URL || null;

  if (!accountSid || !authToken) {
    throw new Error(
      'Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN for SMS dispatch'
    );
  }

  if (!messagingServiceSid && !fromNumber) {
    throw new Error(
      'SMS dispatch needs TWILIO_MESSAGING_SERVICE_SID and/or TWILIO_FROM_NUMBER'
    );
  }

  if (shortenUrls && !messagingServiceSid) {
    throw new Error(
      'TWILIO_SMS_SHORTEN_URLS requires TWILIO_MESSAGING_SERVICE_SID (Messaging Service tied to Link Shortening)'
    );
  }

  return {
    accountSid,
    authToken,
    fromNumber,
    messagingServiceSid,
    shortenUrls,
    statusCallbackUrl,
  };
};

export const sendTwilioSms = async ({ to, body }) => {
  const {
    accountSid,
    authToken,
    fromNumber,
    messagingServiceSid,
    shortenUrls,
    statusCallbackUrl,
  } = getTwilioSmsConfig();

  const payload = new URLSearchParams({
    To: String(to),
    Body: String(body),
  });

  if (messagingServiceSid) {
    payload.set('MessagingServiceSid', messagingServiceSid);
  } else {
    payload.set('From', String(fromNumber));
  }

  payload.set('SmartEncoded', 'true');

  if (shortenUrls) {
    payload.set('ShortenUrls', 'true');
  }

  if (statusCallbackUrl) {
    payload.set('StatusCallback', statusCallbackUrl);
  }

  logger.info(
    {
      twilioShortenUrls: shortenUrls,
      twilioUseMessagingService: Boolean(messagingServiceSid),
    },
    'Twilio Messages POST (body in logs elsewhere may still show long URLs; Twilio shortens at send time when enabled)'
  );

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
  logger.info(
    {
      messageSid: json.sid,
      twilioStatus: json.status,
      to: json.to,
      errorCode: json.error_code ?? null,
      errorMessage: json.error_message ?? null,
    },
    'Twilio message accepted (check Console if phone does not receive — trial limits, carrier, or spam filtering)'
  );
  return {
    messageSid: json.sid,
    status: json.status,
    to: json.to,
    from: json.from,
  };
};

