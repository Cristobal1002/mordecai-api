import { config } from '../config/index.js';
import { health } from './health.route.js';
import { auth } from './auth.route.js';
import { user } from './user.route.js';

export const routes = (server) => {
  server.use(`/api/${config.app.apiVersion}/health`, health);
  server.use(`/api/${config.app.apiVersion}/auth`, auth);
  server.use(`/api/${config.app.apiVersion}/users`, user);
};