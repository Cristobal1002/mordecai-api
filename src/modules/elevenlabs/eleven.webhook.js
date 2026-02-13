import crypto from 'crypto';

const parseSignatureHeader = (header) => {
  if (!header) return null;

  const parts = header
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const map = {};
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (!key || !value) continue;
    map[key.trim()] = value.trim();
  }

  const timestamp = map.t || map.ts || null;
  const signature = map.v0 || map.v1 || map.signature || null;

  if (!timestamp || !signature) return null;
  return { timestamp, signature };
};

const constantTimeCompare = (left, right) => {
  const a = Buffer.from(left || '');
  const b = Buffer.from(right || '');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const calculateSignatures = (secret, timestamp, rawBody) => {
  const payload = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  return [
    crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex'),
    crypto.createHmac('sha256', secret).update(`${timestamp}:${payload}`).digest('hex'),
    crypto.createHmac('sha256', secret).update(payload).digest('hex'),
  ];
};

export const verifyElevenLabsWebhook = ({
  signatureHeader,
  rawBody,
  secret,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000),
}) => {
  if (!secret) return { valid: false, reason: 'missing_secret' };

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return { valid: false, reason: 'missing_signature_parts' };

  const timestamp = Number(parsed.timestamp);
  if (!Number.isFinite(timestamp)) return { valid: false, reason: 'invalid_timestamp' };

  if (Math.abs(nowSeconds - timestamp) > Number(toleranceSeconds || 0)) {
    return { valid: false, reason: 'timestamp_out_of_tolerance' };
  }

  const signatures = calculateSignatures(secret, parsed.timestamp, rawBody);
  const valid = signatures.some((candidate) => constantTimeCompare(candidate, parsed.signature));
  if (!valid) return { valid: false, reason: 'signature_mismatch' };

  return { valid: true, timestamp };
};

