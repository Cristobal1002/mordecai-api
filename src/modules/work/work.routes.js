
import { Router } from 'express';
import { workController } from './work.controller.js';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';
import { param, body } from 'express-validator';

const router = Router();

const validateWorkParams = [
    param('tenantId').isUUID().withMessage('Invalid tenantId'),
    body('limit').optional().isInt({ min: 1, max: 1000 }),
    body('dryRun').optional().isBoolean()
];

// POST /api/v1/work/:tenantId/run
router.post(
    '/:tenantId/run',
    validateWorkParams,
    validateRequest,
    workController.run
);

export default router;
