import crypto from 'crypto';
import {
  COOKIE_NAMES,
  getCookieOptions,
  getCsrfCookieOptions,
  getRefreshCookieMaxAge,
} from '../../utils/cookies.js';

const ACCESS_COOKIE_DEFAULT_MAX_AGE_MS = 60 * 60 * 1000;

export const generateCsrfToken = () =>
  crypto.randomBytes(32).toString('hex');

export const setAuthCookies = (res, tokens = {}) => {
  const baseOptions = getCookieOptions();

  if (tokens.accessToken) {
    const maxAge = tokens.expiresIn
      ? Number(tokens.expiresIn) * 1000
      : ACCESS_COOKIE_DEFAULT_MAX_AGE_MS;
    res.cookie(COOKIE_NAMES.access, tokens.accessToken, {
      ...baseOptions,
      maxAge,
    });
  }

  if (tokens.idToken) {
    const maxAge = tokens.expiresIn
      ? Number(tokens.expiresIn) * 1000
      : ACCESS_COOKIE_DEFAULT_MAX_AGE_MS;
    res.cookie(COOKIE_NAMES.id, tokens.idToken, {
      ...baseOptions,
      maxAge,
    });
  }

  if (tokens.refreshToken) {
    const refreshMaxAge = getRefreshCookieMaxAge();
    res.cookie(COOKIE_NAMES.refresh, tokens.refreshToken, {
      ...baseOptions,
      ...(refreshMaxAge ? { maxAge: refreshMaxAge } : {}),
    });
  }
};

export const clearAuthCookies = (res) => {
  const baseOptions = getCookieOptions();

  res.cookie(COOKIE_NAMES.access, '', { ...baseOptions, maxAge: 0 });
  res.cookie(COOKIE_NAMES.id, '', { ...baseOptions, maxAge: 0 });
  res.cookie(COOKIE_NAMES.refresh, '', { ...baseOptions, maxAge: 0 });
};

export const setCsrfCookie = (res, csrfToken) => {
  const options = getCsrfCookieOptions();
  res.cookie(COOKIE_NAMES.csrf, csrfToken, {
    ...options,
    maxAge: 2 * 60 * 60 * 1000,
  });
};

export const clearCsrfCookie = (res) => {
  const options = getCsrfCookieOptions();
  res.cookie(COOKIE_NAMES.csrf, '', { ...options, maxAge: 0 });
};
