/**
 * Buildium API client — llamadas HTTP al PMS.
 */
import axios from 'axios';
import { logger } from '../../../../utils/logger.js';

export function createBuildiumClient(credentials) {
  const { accessToken } = credentials || {};
  const baseURL = process.env.BUILDIUM_API_URL || 'https://api.buildium.com';

  const client = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
  });

  client.interceptors.response.use(
    (res) => res,
    (err) => {
      logger.warn(
        { status: err.response?.status, data: err.response?.data, url: err.config?.url },
        'Buildium API error'
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
    async testAuth() {
      const response = await client.get('/v1/self');
      return response.data;
    },
  };
}
