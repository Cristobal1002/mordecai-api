import { body, param } from 'express-validator';

export const createDisputeValidator = [
  param('tenantId').isUUID().withMessage('Invalid tenant ID'),
  param('caseId').isUUID().withMessage('Invalid case ID'),
  body('reason')
    .isIn([
      'PAID_ALREADY',
      'WRONG_AMOUNT',
      'WRONG_DEBTOR',
      'LEASE_ENDED',
      'UNDER_LEGAL_REVIEW',
      'PROMISE_OFFLINE',
      'DO_NOT_CONTACT',
      'OTHER',
    ])
    .withMessage('Invalid dispute reason'),
  body('notes').optional().isString().trim().isLength({ max: 2000 }),
  body('evidenceUrls').optional().isArray(),
  body('evidenceUrls.*').optional().isURL(),
];

export const resolveDisputeValidator = [
  param('tenantId').isUUID().withMessage('Invalid tenant ID'),
  param('disputeId').isUUID().withMessage('Invalid dispute ID'),
  body('resolution').optional().isString().trim().isLength({ max: 1000 }),
];
