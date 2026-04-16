import { Router } from 'express';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';
import { discoveryController } from './discovery.controller.js';
import { discoveryIngestSecretGuard } from './discovery.middleware.js';
import { getSessionValidator, upsertSessionValidator } from './discovery.validator.js';

const router = Router();

router.get(
  '/sessions/:clientSessionId',
  getSessionValidator,
  validateRequest,
  discoveryController.getSession
);

router.put(
  '/sessions/:clientSessionId',
  discoveryIngestSecretGuard,
  upsertSessionValidator,
  validateRequest,
  discoveryController.upsertSession
);

export default router;
