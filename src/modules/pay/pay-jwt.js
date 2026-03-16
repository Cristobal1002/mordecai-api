import crypto from 'crypto';

const PAY_JWT_SECRET = process.env.PAY_VERIFY_SECRET || process.env.JWT_SECRET || 'pay-verify-dev-secret';
const TTL_SEC = 15 * 60; // 15 minutes

/**
 * Sign a pay session JWT. Payload: { payToken, exp }.
 */
export const signPaySession = (payToken) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + TTL_SEC;
  const payload = Buffer.from(JSON.stringify({ payToken, exp })).toString('base64url');
  const toSign = `${header}.${payload}`;
  const sig = crypto.createHmac('sha256', PAY_JWT_SECRET).update(toSign).digest('base64url');
  return `${toSign}.${sig}`;
};

/**
 * Verify and decode pay session JWT. Returns { payToken } or null.
 */
export const verifyPaySession = (jwt) => {
  if (!jwt || typeof jwt !== 'string') return null;
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  try {
    const [header, payloadB64, sig] = parts;
    const toSign = `${header}.${payloadB64}`;
    const expected = crypto.createHmac('sha256', PAY_JWT_SECRET).update(toSign).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
};
