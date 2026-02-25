import { Router } from 'express';
import { automationController } from './automation.controller.js';
import {
  listAutomationsValidator,
  getAutomationValidator,
  createAutomationValidator,
  activateAutomationValidator,
  pauseAutomationValidator,
  stopAutomationValidator,
  deleteAutomationValidator,
  getSummaryValidator,
  getCasesValidator,
  getActivityValidator,
  enrollAutomationValidator,
  recomputeStagesValidator,
} from './automation.validator.js';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';

const router = Router();

// GET /api/v1/tenants/:tenantId/automations?pmsConnectionId=...
router.get('/:tenantId/automations', listAutomationsValidator, validateRequest, automationController.list);

// POST /api/v1/tenants/:tenantId/automations
router.post('/:tenantId/automations', createAutomationValidator, validateRequest, automationController.create);

// GET /api/v1/tenants/:tenantId/automations/:automationId
router.get('/:tenantId/automations/:automationId', getAutomationValidator, validateRequest, automationController.getById);

// POST /api/v1/tenants/:tenantId/automations/:automationId/activate
router.post(
  '/:tenantId/automations/:automationId/activate',
  activateAutomationValidator,
  validateRequest,
  automationController.activate
);

// POST /api/v1/tenants/:tenantId/automations/:automationId/pause
router.post(
  '/:tenantId/automations/:automationId/pause',
  pauseAutomationValidator,
  validateRequest,
  automationController.pause
);

// POST /api/v1/tenants/:tenantId/automations/:automationId/stop
router.post(
  '/:tenantId/automations/:automationId/stop',
  stopAutomationValidator,
  validateRequest,
  automationController.stop
);

// DELETE /api/v1/tenants/:tenantId/automations/:automationId
router.delete(
  '/:tenantId/automations/:automationId',
  deleteAutomationValidator,
  validateRequest,
  automationController.delete
);

// GET /api/v1/tenants/:tenantId/automations/:automationId/summary
router.get(
  '/:tenantId/automations/:automationId/summary',
  getSummaryValidator,
  validateRequest,
  automationController.getSummary
);

// GET /api/v1/tenants/:tenantId/automations/:automationId/cases
router.get(
  '/:tenantId/automations/:automationId/cases',
  getCasesValidator,
  validateRequest,
  automationController.getCases
);

// GET /api/v1/tenants/:tenantId/automations/:automationId/activity
router.get(
  '/:tenantId/automations/:automationId/activity',
  getActivityValidator,
  validateRequest,
  automationController.getActivity
);

// GET /api/v1/tenants/:tenantId/automations/:automationId/agreements
router.get(
  '/:tenantId/automations/:automationId/agreements',
  getActivityValidator,
  validateRequest,
  automationController.getAgreements
);

// POST /api/v1/tenants/:tenantId/automations/:automationId/enroll
router.post(
  '/:tenantId/automations/:automationId/enroll',
  enrollAutomationValidator,
  validateRequest,
  automationController.enroll
);

// POST /api/v1/tenants/:tenantId/automations/:automationId/recompute-stages
router.post(
  '/:tenantId/automations/:automationId/recompute-stages',
  recomputeStagesValidator,
  validateRequest,
  automationController.recomputeStages
);

export default router;
