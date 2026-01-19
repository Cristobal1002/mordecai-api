/**
 * Validator - Validaciones de entrada
 * 
 * Este archivo define las validaciones de los datos de entrada
 * usando express-validator. Estas validaciones se ejecutan antes
 * de llegar al controller.
 */
import { body, query } from 'express-validator';

export const createExampleValidator = [
  body('name')
    .notEmpty()
    .withMessage('name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('name must be between 3 and 100 characters'),
  body('description')
    .optional()
    .isString()
    .withMessage('description must be a string'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('status must be either "active" or "inactive"'),
];

export const updateExampleValidator = [
  body('name')
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage('name must be between 3 and 100 characters'),
  body('description')
    .optional()
    .isString()
    .withMessage('description must be a string'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('status must be either "active" or "inactive"'),
];

export const listExampleValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),
  query('perPage')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('perPage must be between 1 and 100'),
  query('name')
    .optional()
    .isString()
    .withMessage('name must be a string'),
  query('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('status must be either "active" or "inactive"'),
];

