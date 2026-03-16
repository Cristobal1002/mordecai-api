import { Router } from 'express';
import { disputeController } from './dispute.controller.js';
import { requireAuth } from '../../middlewares/index.js';
import { createDisputeValidator, resolveDisputeValidator } from './dispute.validator.js';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';

const router = Router();

// POST /api/v1/tenants/:tenantId/cases/:caseId/disputes
router.post(
  '/:tenantId/cases/:caseId/disputes',
  requireAuth(),
  createDisputeValidator,
  validateRequest,
  disputeController.create
);

// POST /api/v1/tenants/:tenantId/disputes/:disputeId/resolve
router.post(
  '/:tenantId/disputes/:disputeId/resolve',
  requireAuth(),
  resolveDisputeValidator,
  validateRequest,
  disputeController.resolve
);

export default router;
