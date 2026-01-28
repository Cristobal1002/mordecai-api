import { Router } from 'express';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';
import { requireAuth } from '../../middlewares/index.js';
import { membershipController } from './membership.controller.js';
import {
  deleteMemberValidator,
  inviteMemberValidator,
  memberIdParam,
  tenantIdParam,
  updateMemberValidator,
} from './membership.validator.js';

const router = Router();

// GET /api/v1/tenants/:tenantId/members
router.get(
  '/:tenantId/members',
  requireAuth(),
  tenantIdParam,
  validateRequest,
  membershipController.list
);

// POST /api/v1/tenants/:tenantId/members
router.post(
  '/:tenantId/members',
  requireAuth(),
  inviteMemberValidator,
  validateRequest,
  membershipController.invite
);

// PATCH /api/v1/tenants/:tenantId/members/:userId
router.patch(
  '/:tenantId/members/:userId',
  requireAuth(),
  updateMemberValidator,
  validateRequest,
  membershipController.update
);

// DELETE /api/v1/tenants/:tenantId/members/:userId
router.delete(
  '/:tenantId/members/:userId',
  requireAuth(),
  deleteMemberValidator,
  validateRequest,
  membershipController.remove
);

export default router;
