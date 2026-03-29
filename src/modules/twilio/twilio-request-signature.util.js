import crypto from 'crypto';

/**
 * Validates Twilio POST webhooks with `Content-Type: application/json`.
 * @see https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export function validateTwilioRequestWithJsonBody(
  authToken,
  twilioSignature,
  url,
  rawBody
) {
  if (!authToken || !twilioSignature || url == null || rawBody == null) {
    return false;
  }
  const hmac = crypto.createHmac('sha1', authToken);
  hmac.update(url, 'utf8');
  hmac.update(rawBody, 'utf8');
  const expected = hmac.digest('base64');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(twilioSignature), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** URL Twilio used for the request (must match Console callback URL for signature). */
export function resolveTwilioWebhookUrl(req) {
  const fixed = process.env.TWILIO_LINK_CLICK_WEBHOOK_URL?.trim();
  if (fixed) return fixed;
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'https')
    .split(',')[0]
    .trim();
  const host = (req.get('x-forwarded-host') || req.get('host') || '')
    .split(',')[0]
    .trim();
  return `${proto}://${host}${req.originalUrl || req.url}`;
}
