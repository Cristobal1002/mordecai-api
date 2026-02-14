/**
 * Rentvine API client — llamadas HTTP al PMS.
 * Auth: HTTP Basic con access key como username y secret como password.
 * Base URL: https://{subdomain}.rentvine.com/api/manager
 * Account/subdomain is required; accepts "b4imanagement" or full URL "https://b4imanagement.rentvine.com".
 * @see https://docs.rentvine.com/
 */
import axios from 'axios';
import { logger } from '../../../../utils/logger.js';

/**
 * Normalize account to subdomain only. Accepts:
 * - Full URL: https://b4imanagement.rentvine.com → b4imanagement
 * - Host: b4imanagement.rentvine.com → b4imanagement
 * - Subdomain: b4imanagement → b4imanagement
 */
function getSubdomain(account) {
  if (!account || typeof account !== 'string') return '';
  const raw = account.trim();
  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const u = new URL(raw);
      const host = u.hostname;
      if (host.endsWith('.rentvine.com')) {
        return host.slice(0, -'.rentvine.com'.length);
      }
      return host;
    }
    if (raw.includes('.rentvine.com')) {
      return raw.split('.rentvine.com')[0].trim();
    }
    return raw;
  } catch {
    return raw;
  }
}

export function createRentvineClient(credentials) {
  const accessKey = credentials?.accessKey ?? credentials?.access_key ?? '';
  const secret = credentials?.secret ?? '';
  const subdomain = getSubdomain(credentials?.account ?? '');
  const host = subdomain ? `${subdomain}.rentvine.com` : 'example.rentvine.com';
  const baseURL =
    process.env.RENTVINE_API_URL || `https://${host}/api/manager`;

  const basicAuth =
    accessKey && secret
      ? Buffer.from(`${accessKey}:${secret}`, 'utf8').toString('base64')
      : '';

  const client = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      ...(basicAuth && { Authorization: `Basic ${basicAuth}` }),
    },
  });

  client.interceptors.response.use(
    (res) => res,
    (err) => {
      logger.warn(
        { status: err.response?.status, data: err.response?.data, url: err.config?.url },
        'Rentvine API error'
      );
      return Promise.reject(err);
    }
  );

  return {
    async get(path, params = {}) {
      const { data } = await client.get(path, { params });
      return data;
    },
    async post(path, body) {
      const { data } = await client.post(path, body);
      return data;
    },
    /** Prueba credenciales con listado de portfolios (requiere Basic Auth). */
    async testAuth() {
      const response = await client.get('/portfolios/search', { params: { pageSize: 1 } });
      return response.data;
    },
  };
}
