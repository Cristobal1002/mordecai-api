import { Router } from 'express';
import { tenantController } from './tenant.controller.js';
import { createTenantValidator, updateTenantValidator } from './tenant.validator.js';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';
import { requireAuth } from '../../middlewares/index.js';
import { param } from 'express-validator';

const router = Router();

// POST /api/v1/tenants
router.post(
  '/',
  requireAuth(),
  createTenantValidator,
  validateRequest,
  tenantController.create
);

// GET /api/v1/tenants/:tenantId/admin — Admin snapshot (tenant + members + stats)
router.get(
  '/:tenantId/admin',
  requireAuth(),
  param('tenantId').isUUID().withMessage('tenantId must be a valid UUID'),
  validateRequest,
  tenantController.getAdminSnapshot
);

// PATCH /api/v1/tenants/:tenantId — Update tenant (name, timezone, settings)
router.patch(
  '/:tenantId',
  requireAuth(),
  param('tenantId').isUUID().withMessage('tenantId must be a valid UUID'),
  updateTenantValidator,
  validateRequest,
  tenantController.update
);

export default router;
