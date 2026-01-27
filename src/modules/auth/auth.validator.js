import { body } from 'express-validator';

const e164PhoneRegex = /^\+[1-9]\d{7,14}$/;

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
    .matches(e164PhoneRegex)
    .withMessage('phone must be in E.164 format, e.g. +15551234567'),
  body('phoneNumber')
    .optional({ nullable: true })
    .matches(e164PhoneRegex)
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
  body('email').isEmail().withMessage('Valid email is required'),
  body('refreshToken')
    .isString()
    .isLength({ min: 10 })
    .withMessage('refreshToken is required'),
];
