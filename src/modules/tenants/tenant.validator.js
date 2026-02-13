
import { body } from 'express-validator';

const e164PhoneRegex = /^\+[1-9]\d{7,14}$/;
const normalizePhone = (v) =>
  !v || typeof v !== 'string' ? v : v.replace(/[\s()-]/g, '');
const validateE164 = (v) => !v || e164PhoneRegex.test(v);

export const createTenantValidator = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ min: 3 })
        .withMessage('Name must be at least 3 characters long'),
    body('fullName')
        .optional()
        .isString()
        .isLength({ min: 2 })
        .withMessage('fullName must have at least 2 characters'),
    body('phone')
        .optional({ nullable: true })
        .customSanitizer(normalizePhone)
        .custom(validateE164)
        .withMessage('phone must be in E.164 format, e.g. +15551234567'),
];
