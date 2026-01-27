import { body, query } from 'express-validator';

const e164PhoneRegex = /^\+[1-9]\d{7,14}$/;
const oauthProviders = ['Google', 'Microsoft', 'google', 'microsoft'];

const normalizePhoneInput = (value) => {
  if (!value || typeof value !== 'string') {
    return value;
  }
  return value.replace(/[\s()-]/g, '');
};

const validateE164 = (value) => {
  if (!value) {
    return true;
  }
  return e164PhoneRegex.test(value);
};

export const registerValidator = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password')
    .isString()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('name')
    .optional()
    .isString()
    .isLength({ min: 2 })
    .withMessage('Name must have at least 2 characters'),
  body('phone')
    .optional({ nullable: true })
    .customSanitizer(normalizePhoneInput)
    .custom(validateE164)
    .withMessage('phone must be in E.164 format, e.g. +15551234567'),
  body('phoneNumber')
    .optional({ nullable: true })
    .customSanitizer(normalizePhoneInput)
    .custom(validateE164)
    .withMessage('phoneNumber must be in E.164 format, e.g. +15551234567'),
  body('acceptedTerms')
    .isBoolean()
    .withMessage('acceptedTerms must be a boolean')
    .custom((value) => value === true)
    .withMessage('You must accept the terms'),
];

export const confirmValidator = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('code')
    .isString()
    .isLength({ min: 4, max: 10 })
    .withMessage('Confirmation code is required'),
];

export const loginValidator = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Password is required'),
];

export const refreshValidator = [
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('refreshToken')
    .optional()
    .isString()
    .isLength({ min: 10 })
    .withMessage('refreshToken is required'),
];

export const oauthStartValidator = [
  query('provider')
    .isString()
    .isIn(oauthProviders)
    .withMessage('provider must be Google or Microsoft'),
  query('state').optional().isString(),
];

export const oauthCallbackValidator = [
  query('code').isString().notEmpty().withMessage('code is required'),
  query('state').optional().isString(),
];

export const forgotValidator = [
  body('email').isEmail().withMessage('Valid email is required'),
];

export const resetValidator = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('code')
    .isString()
    .isLength({ min: 4, max: 10 })
    .withMessage('Confirmation code is required'),
  body('password')
    .isString()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
];

export const resendConfirmValidator = [
  body('email').isEmail().withMessage('Valid email is required'),
];

export const logoutValidator = [
  body('refreshToken')
    .optional()
    .isString()
    .isLength({ min: 10 })
    .withMessage('refreshToken is required'),
];
