/**
 * Rentvine API client — llamadas HTTP al PMS.
 * Auth: HTTP Basic con access key como username y secret como password.
 * Base URL: https://{account}.rentvine.com/api/manager
 * @see https://docs.rentvine.com/
 */
import axios from 'axios';
import { logger } from '../../../../utils/logger.js';

export function createRentvineClient(credentials) {
  const accessKey = credentials?.accessKey ?? credentials?.access_key ?? '';
  const secret = credentials?.secret ?? '';
  const account = credentials?.account ?? 'example';
  const baseURL =
    process.env.RENTVINE_API_URL || `https://${account}.rentvine.com/api/manager`;

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
