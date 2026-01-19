import { Router } from 'express';
import health from './health.route.js';
// Importar módulos aquí
import exampleRoutes from '../modules/example/example.routes.js';

import { config } from '../config/index.js';

const routes = (app) => {
  const router = Router();

  router.use('/health', health);
  // Agregar módulos aquí
  router.use('/examples', exampleRoutes);

  app.use(`/api/${config.app.apiVersion}`, router);
};

export default routes;