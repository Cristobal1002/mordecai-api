const parseBoolean = (value, fallback) => {
  if (value === undefined) {
    return fallback;
  }
  return String(value).toLowerCase() === 'true';
};

export const COOKIE_NAMES = {
  access: process.env.AUTH_ACCESS_COOKIE_NAME || 'access_token',
  id: process.env.AUTH_ID_COOKIE_NAME || 'id_token',
  refresh: process.env.AUTH_REFRESH_COOKIE_NAME || 'refresh_token',
  csrf: process.env.AUTH_CSRF_COOKIE_NAME || 'csrf_token',
};

export const parseCookies = (cookieHeader = '') => {
  const cookies = {};

  if (!cookieHeader) {
    return cookies;
  }

  cookieHeader.split(';').forEach((pair) => {
    const trimmed = pair.trim();
    if (!trimmed) {
      return;
    }
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      return;
    }
    const name = decodeURIComponent(trimmed.slice(0, separatorIndex));
    const value = decodeURIComponent(trimmed.slice(separatorIndex + 1));
    cookies[name] = value;
  });

  return cookies;
};

const normalizeSameSite = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (['lax', 'strict', 'none'].includes(normalized)) {
    return normalized;
  }
  return 'lax';
};

export const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  const sameSite = normalizeSameSite(process.env.AUTH_COOKIE_SAMESITE);
  const secure = sameSite === 'none'
    ? true
    : parseBoolean(process.env.AUTH_COOKIE_SECURE, isProd);

  const domain = process.env.AUTH_COOKIE_DOMAIN || undefined;
  const path = process.env.AUTH_COOKIE_PATH || '/';

  return {
    httpOnly: true,
    secure,
    sameSite,
    domain,
    path,
  };
};

export const getCsrfCookieOptions = () => ({
  ...getCookieOptions(),
  httpOnly: false,
});

export const getRefreshCookieMaxAge = () => {
  const days = Number(process.env.AUTH_REFRESH_TOKEN_MAX_AGE_DAYS);
  if (!days || Number.isNaN(days) || days <= 0) {
    return undefined;
  }
  return days * 24 * 60 * 60 * 1000;
};
