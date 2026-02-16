import crypto from 'crypto';

const DEFAULT_VERSION = '1';

const buildSignedPayload = ({ interactionId, tenantId, caseId, exp, version }) =>
  `${interactionId}|${tenantId}|${caseId}|${exp}|${version || DEFAULT_VERSION}`;

const safeCompare = (left, right) => {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const signPayload = (payload, secret) => {
  const digestBuffer = crypto.createHmac('sha256', secret).update(payload).digest();
  return {
    hex: digestBuffer.toString('hex'),
    base64url: digestBuffer.toString('base64url'),
  };
};

export const verifyVoiceContextSignature = ({
  interactionId,
  tenantId,
  caseId,
  exp,
  version = DEFAULT_VERSION,
  signature,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
}) => {
  if (!secret) {
    return { valid: false, reason: 'missing_secret' };
  }

  if (!interactionId || !tenantId || !caseId || !exp || !signature) {
    return { valid: false, reason: 'missing_parts' };
  }

  const expNumber = Number(exp);
  if (!Number.isFinite(expNumber)) {
    return { valid: false, reason: 'invalid_exp' };
  }

  if (expNumber < nowSeconds) {
    return { valid: false, reason: 'expired' };
  }

  const payload = buildSignedPayload({ interactionId, tenantId, caseId, exp: expNumber, version });
  const expected = signPayload(payload, secret);
  const provided = String(signature).trim();

  const valid = safeCompare(provided, expected.base64url) || safeCompare(provided, expected.hex);
  if (!valid) {
    return { valid: false, reason: 'signature_mismatch' };
  }

  return { valid: true };
};

export const createVoiceContextSignature = ({
  interactionId,
  tenantId,
  caseId,
  exp,
  version = DEFAULT_VERSION,
  secret,
  format = 'base64url',
}) => {
  const payload = buildSignedPayload({ interactionId, tenantId, caseId, exp, version });
  const signatures = signPayload(payload, secret);
  return signatures[format] || signatures.base64url;
};

