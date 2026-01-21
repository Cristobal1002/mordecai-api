
import { Router } from 'express';
import { debtCaseController } from './debt-case.controller.js';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';
import { param } from 'express-validator';

const router = Router();

const validateTenant = [
    param('tenantId').isUUID().withMessage('Invalid Tenant ID')
];

const validateCase = [
    ...validateTenant,
    param('caseId').isUUID().withMessage('Invalid Case ID')
];

// GET /api/v1/debt-cases/:tenantId
router.get(
    '/:tenantId',
    validateTenant,
    validateRequest,
    debtCaseController.list
);

// GET /api/v1/debt-cases/:tenantId/:caseId/logs
router.get(
    '/:tenantId/:caseId/logs',
    validateCase,
    validateRequest,
    debtCaseController.getLogs
);

export default router;
