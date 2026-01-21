
import { Router } from 'express';
import { tenantController } from './tenant.controller.js';
import { createTenantValidator, seedFlowPoliciesValidator } from './tenant.validator.js';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';

const router = Router();

// POST /api/v1/tenants
router.post(
    '/',
    createTenantValidator,
    validateRequest,
    tenantController.create
);

// POST /api/v1/tenants/:tenantId/flow-policies/seed
router.post(
    '/:tenantId/flow-policies/seed',
    seedFlowPoliciesValidator,
    validateRequest,
    tenantController.seedFlowPolicies
);

export default router;
