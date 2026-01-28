const base64UrlToBase64 = (value) => value.replace(/-/g, '+').replace(/_/g, '/');

const addPadding = (value) => {
  const padding = 4 - (value.length % 4);
  if (padding === 4) {
    return value;
  }
  return value + '='.repeat(padding);
};

export const decodeJwtPayload = (token) => {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = addPadding(base64UrlToBase64(parts[1]));
    const json = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
};
