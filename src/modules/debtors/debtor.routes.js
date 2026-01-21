
import { Router } from 'express';
import { debtorController } from './debtor.controller.js';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';
import { param } from 'express-validator';

const router = Router();

// GET /api/v1/debtors/:tenantId
router.get(
    '/:tenantId',
    param('tenantId').isUUID().withMessage('Invalid Tenant ID'),
    validateRequest,
    debtorController.list
);

export default router;
