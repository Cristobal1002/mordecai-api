import { config } from '../config/index.js';
import { health } from './health.route.js';

export const routes = (server) => {
  server.use(`/api/${config.app.apiVersion}/health`, health);
};