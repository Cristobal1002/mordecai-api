import { Router } from 'express';
import { propertyManagersController } from './property-managers.controller.js';
import {
  listPropertyManagersValidator,
  getPropertyManagerValidator,
  createPropertyManagerValidator,
  updateCredentialsValidator,
  updateStatusValidator,
  testConnectionValidator,
  testCredentialsValidator,
  triggerSyncValidator,
} from './property-managers.validator.js';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';
import { requireAuth } from '../../middlewares/index.js';

const router = Router();

// GET /api/v1/tenants/:tenantId/pms-connections
router.get(
  '/:tenantId/pms-connections',
  requireAuth(),
  listPropertyManagersValidator,
  validateRequest,
  propertyManagersController.listByTenant
);

// GET /api/v1/tenants/:tenantId/pms-connections/:connectionId/credentials (must be before :connectionId)
router.get(
  '/:tenantId/pms-connections/:connectionId/credentials',
  requireAuth(),
  getPropertyManagerValidator,
  validateRequest,
  propertyManagersController.getCredentials
);

// GET /api/v1/tenants/:tenantId/pms-connections/:connectionId
router.get(
  '/:tenantId/pms-connections/:connectionId',
  requireAuth(),
  getPropertyManagerValidator,
  validateRequest,
  propertyManagersController.getById
);

// POST /api/v1/tenants/:tenantId/pms-connections
router.post(
  '/:tenantId/pms-connections',
  requireAuth(),
  createPropertyManagerValidator,
  validateRequest,
  propertyManagersController.create
);

// PATCH /api/v1/tenants/:tenantId/pms-connections/:connectionId/credentials
router.patch(
  '/:tenantId/pms-connections/:connectionId/credentials',
  requireAuth(),
  updateCredentialsValidator,
  validateRequest,
  propertyManagersController.updateCredentials
);

// PATCH /api/v1/tenants/:tenantId/pms-connections/:connectionId/status
router.patch(
  '/:tenantId/pms-connections/:connectionId/status',
  requireAuth(),
  updateStatusValidator,
  validateRequest,
  propertyManagersController.updateStatus
);

// DELETE /api/v1/tenants/:tenantId/pms-connections/:connectionId
router.delete(
  '/:tenantId/pms-connections/:connectionId',
  requireAuth(),
  getPropertyManagerValidator,
  validateRequest,
  propertyManagersController.delete
);

// POST /api/v1/tenants/:tenantId/pms-connections/:connectionId/test
router.post(
  '/:tenantId/pms-connections/:connectionId/test',
  requireAuth(),
  testConnectionValidator,
  validateRequest,
  propertyManagersController.testConnection
);

// POST /api/v1/tenants/:tenantId/pms-connections/test-credentials
router.post(
  '/:tenantId/pms-connections/test-credentials',
  requireAuth(),
  testCredentialsValidator,
  validateRequest,
  propertyManagersController.testCredentials
);

// POST /api/v1/tenants/:tenantId/pms-connections/:connectionId/sync
router.post(
  '/:tenantId/pms-connections/:connectionId/sync',
  requireAuth(),
  triggerSyncValidator,
  validateRequest,
  propertyManagersController.triggerSync
);

export default router;
