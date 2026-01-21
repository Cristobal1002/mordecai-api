
import { body, param } from 'express-validator';

export const createTenantValidator = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ min: 3 })
        .withMessage('Name must be at least 3 characters long'),
    body('slug')
        .trim()
        .notEmpty()
        .withMessage('Slug is required')
        .isAlphanumeric()
        .withMessage('Slug must only contain letters and numbers'),
    body('email')
        .optional()
        .isEmail()
        .withMessage('Invalid email format'),
];

export const seedFlowPoliciesValidator = [
    param('tenantId')
        .isUUID()
        .withMessage('Invalid tenant ID format (UUID required)'),
];
