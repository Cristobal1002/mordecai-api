import { Router } from 'express';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';
import { requireAuth } from '../../middlewares/index.js';
import { invitationController } from './invitation.controller.js';
import { acceptInvitationValidator } from './invitation.validator.js';

const router = Router();

// POST /api/v1/invitations/:token/accept
router.post(
  '/:token/accept',
  requireAuth(),
  acceptInvitationValidator,
  validateRequest,
  invitationController.accept
);

export default router;
