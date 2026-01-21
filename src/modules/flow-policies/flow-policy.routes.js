import { Router } from 'express';
import { flowPolicyController } from './flow-policy.controller.js';
import {
  createFlowPolicyValidator,
  listFlowPoliciesValidator,
} from './flow-policy.validator.js';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';

const router = Router();

// GET /api/v1/tenants/:tenantId/flow-policies
router.get(
  '/:tenantId/flow-policies',
  listFlowPoliciesValidator,
  validateRequest,
  flowPolicyController.listByTenant
);

// POST /api/v1/tenants/:tenantId/flow-policies
router.post(
  '/:tenantId/flow-policies',
  createFlowPolicyValidator,
  validateRequest,
  flowPolicyController.create
);

export default router;
