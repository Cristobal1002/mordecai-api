import { Router } from 'express';
import health from './health.route.js';
// Importar módulos aquí
import exampleRoutes from '../modules/example/example.routes.js';
import tenantRoutes from '../modules/tenants/tenant.routes.js';
import flowPolicyRoutes from '../modules/flow-policies/flow-policy.routes.js';
import importRoutes from '../modules/imports/import.routes.js';
import workRoutes from '../modules/work/work.routes.js';
import debtorRoutes from '../modules/debtors/debtor.routes.js';
import debtCaseRoutes from '../modules/debt-cases/debt-case.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';

import { config } from '../config/index.js';

const routes = (app) => {
  const router = Router();

  router.use('/health', health);
  // Agregar módulos aquí
  router.use('/examples', exampleRoutes);
  router.use('/auth', authRoutes);
  router.use('/tenants', tenantRoutes);
  router.use('/tenants', flowPolicyRoutes);
  router.use('/import-batches', importRoutes);
  router.use('/work', workRoutes);
  router.use('/debtors', debtorRoutes);
  router.use('/debt-cases', debtCaseRoutes);

  app.use(`/api/${config.app.apiVersion}`, router);
};

export default routes;
