import { Router } from 'express';
import { automationController } from './automation.controller.js';
import {
  listAutomationsValidator,
  getAutomationValidator,
  updateAutomationValidator,
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
  runStrategyForCaseValidator,
  bulkCasesValidator,
  getOverviewValidator,
  bulkByFiltersValidator,
} from './automation.validator.js';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';

const router = Router();

// GET /api/v1/tenants/:tenantId/automations?pmsConnectionId=...
router.get('/:tenantId/automations', listAutomationsValidator, validateRequest, automationController.list);

// POST /api/v1/tenants/:tenantId/automations
router.post('/:tenantId/automations', createAutomationValidator, validateRequest, automationController.create);

// GET /api/v1/tenants/:tenantId/automations/:automationId
router.get('/:tenantId/automations/:automationId', getAutomationValidator, validateRequest, automationController.getById);

// PATCH /api/v1/tenants/:tenantId/automations/:automationId
router.patch(
  '/:tenantId/automations/:automationId',
  updateAutomationValidator,
  validateRequest,
  automationController.update
);

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

// GET /api/v1/tenants/:tenantId/automations/:automationId/overview
router.get(
  '/:tenantId/automations/:automationId/overview',
  getOverviewValidator,
  validateRequest,
  automationController.getOverview
);

// GET /api/v1/tenants/:tenantId/automations/:automationId/cases
router.get(
  '/:tenantId/automations/:automationId/cases',
  getCasesValidator,
  validateRequest,
  automationController.getCases
);

// POST /api/v1/tenants/:tenantId/automations/:automationId/cases/bulk-approve
router.post(
  '/:tenantId/automations/:automationId/cases/bulk-approve',
  bulkCasesValidator,
  validateRequest,
  automationController.bulkApprove
);

// POST /api/v1/tenants/:tenantId/automations/:automationId/cases/bulk-reject
router.post(
  '/:tenantId/automations/:automationId/cases/bulk-reject',
  bulkCasesValidator,
  validateRequest,
  automationController.bulkReject
);

// POST /api/v1/tenants/:tenantId/automations/:automationId/cases/bulk-exclude
router.post(
  '/:tenantId/automations/:automationId/cases/bulk-exclude',
  bulkCasesValidator,
  validateRequest,
  automationController.bulkExclude
);

// POST /api/v1/tenants/:tenantId/automations/:automationId/cases/bulk
router.post(
  '/:tenantId/automations/:automationId/cases/bulk',
  bulkByFiltersValidator,
  validateRequest,
  automationController.bulkByFilters
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

// GET /api/v1/tenants/:tenantId/automations/:automationId/cases/:debtCaseId/activity
router.get(
  '/:tenantId/automations/:automationId/cases/:debtCaseId/activity',
  runStrategyForCaseValidator,
  validateRequest,
  automationController.getCaseTimeline
);

// POST /api/v1/tenants/:tenantId/automations/:automationId/cases/:debtCaseId/run-strategy
router.post(
  '/:tenantId/automations/:automationId/cases/:debtCaseId/run-strategy',
  runStrategyForCaseValidator,
  validateRequest,
  automationController.runStrategyForCase
);

// POST /api/v1/tenants/:tenantId/automations/:automationId/cases/:debtCaseId/trigger-sms
router.post(
  '/:tenantId/automations/:automationId/cases/:debtCaseId/trigger-sms',
  runStrategyForCaseValidator,
  validateRequest,
  automationController.triggerCaseSms
);

// POST /api/v1/tenants/:tenantId/automations/:automationId/cases/:debtCaseId/trigger-email
router.post(
  '/:tenantId/automations/:automationId/cases/:debtCaseId/trigger-email',
  runStrategyForCaseValidator,
  validateRequest,
  automationController.triggerCaseEmail
);

export default router;
