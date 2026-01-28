import { COOKIE_NAMES, parseCookies } from './cookies.js';
import { decodeJwtPayload } from './jwt.js';

const normalizeEmail = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : null;

export const getAuthIdentity = (req) => {
  const accessPayload = req.user || {};
  const cookies = parseCookies(req.headers.cookie);
  const idPayload = decodeJwtPayload(cookies[COOKIE_NAMES.id]);

  const sub = accessPayload.sub || idPayload?.sub || null;
  const email =
    normalizeEmail(accessPayload.email) ||
    normalizeEmail(idPayload?.email) ||
    normalizeEmail(idPayload?.['cognito:username']) ||
    normalizeEmail(idPayload?.username);
  const fullName = idPayload?.name || idPayload?.['given_name'] || null;
  const phone = idPayload?.phone_number || null;

  return {
    sub,
    email,
    fullName,
    phone,
  };
};
