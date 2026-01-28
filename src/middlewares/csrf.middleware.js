import { ForbiddenError } from '../errors/index.js';
import { COOKIE_NAMES, parseCookies } from '../utils/cookies.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const requireCsrf = () => (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  if (req.get('authorization')) {
    return next();
  }

  const cookies = parseCookies(req.headers.cookie);
  const hasAuthCookie =
    cookies[COOKIE_NAMES.access] ||
    cookies[COOKIE_NAMES.refresh] ||
    cookies[COOKIE_NAMES.id];

  if (!hasAuthCookie) {
    return next();
  }

  const csrfCookie = cookies[COOKIE_NAMES.csrf];
  const csrfHeader =
    req.get('x-csrf-token') || req.get('x-xsrf-token');

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return next(new ForbiddenError('CSRF token mismatch.'));
  }

  return next();
};
