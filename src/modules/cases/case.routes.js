import { Router } from 'express';
import { caseController } from './case.controller.js';
import {
  getCaseValidator,
  getTimelineValidator,
  pauseCaseValidator,
  resumeCaseValidator,
} from './case.validator.js';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';

const router = Router();

// GET /api/v1/tenants/:tenantId/cases/:caseId
router.get('/:tenantId/cases/:caseId', getCaseValidator, validateRequest, caseController.getDetail);

// GET /api/v1/tenants/:tenantId/cases/:caseId/timeline
router.get(
  '/:tenantId/cases/:caseId/timeline',
  getTimelineValidator,
  validateRequest,
  caseController.getTimeline
);

// POST /api/v1/tenants/:tenantId/cases/:caseId/pause
router.post(
  '/:tenantId/cases/:caseId/pause',
  pauseCaseValidator,
  validateRequest,
  caseController.pause
);

// POST /api/v1/tenants/:tenantId/cases/:caseId/resume
router.post(
  '/:tenantId/cases/:caseId/resume',
  resumeCaseValidator,
  validateRequest,
  caseController.resume
);

export default router;
