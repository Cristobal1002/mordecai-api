
import { Router } from 'express';
import { tenantController } from './tenant.controller.js';
import { createTenantValidator } from './tenant.validator.js';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';
import { requireAuth } from '../../middlewares/index.js';

const router = Router();

// POST /api/v1/tenants
router.post(
    '/',
    requireAuth(),
    createTenantValidator,
    validateRequest,
    tenantController.create
);

export default router;
