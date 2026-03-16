import { Router } from 'express';
import { dashboardController } from './dashboard.controller.js';
import { getOverviewValidator } from './dashboard.validator.js';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';
import { requireAuth } from '../../middlewares/index.js';

const router = Router();

// GET /api/v1/tenants/:tenantId/dashboard/overview?range=...&connectionId=...
router.get(
  '/:tenantId/dashboard/overview',
  requireAuth(),
  getOverviewValidator,
  validateRequest,
  dashboardController.getOverview
);

export default router;
