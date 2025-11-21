import { Router } from 'express';
import { userController } from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate-request.middleware.js';
import { body, param, query } from 'express-validator';

const router = Router();

// Validation schemas
// Remove preferences validation if not using preferences
// const updatePreferencesValidation = [
//   body('*').optional(),
// ];

const updateRoleValidation = [
  param('firebaseUid').notEmpty().withMessage('Firebase UID is required'),
  body('appRole').isIn(['user', 'admin', 'moderator', 'manager', 'editor']).withMessage('Invalid app role'),
];

const userParamValidation = [
  param('firebaseUid').notEmpty().withMessage('Firebase UID is required'),
];

const usersListValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('appRole').optional().isIn(['user', 'admin', 'moderator', 'manager', 'editor']).withMessage('Invalid app role'),
  query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  query('search').optional().isLength({ min: 1, max: 100 }).withMessage('Search term must be between 1 and 100 characters'),
  query('sortBy').optional().isIn(['createdAt', 'updatedAt', 'lastLoginAt', 'appRole']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['ASC', 'DESC', 'asc', 'desc']).withMessage('Sort order must be ASC or DESC'),
  query('includeDeleted').optional().isBoolean().withMessage('includeDeleted must be a boolean'),
  query('dateFrom').optional().isISO8601().withMessage('dateFrom must be a valid ISO date'),
  query('dateTo').optional().isISO8601().withMessage('dateTo must be a valid ISO date'),
];

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get current user profile (with Firebase data)
 * @access  Private
 */
router.get('/profile', authenticate, userController.getProfile);

// Remove preferences route if not using preferences
// /**
//  * @route   PUT /api/v1/users/preferences
//  * @desc    Update user preferences
//  * @access  Private
//  */
// router.put('/preferences', authenticate, updatePreferencesValidation, validateRequest, userController.updatePreferences);

/**
 * @route   GET /api/v1/users
 * @desc    Get users list with advanced filtering and search (admin/moderator only)
 * @access  Private (Admin/Moderator)
 * @query   page, limit, appRole, isActive, search, sortBy, sortOrder, includeDeleted, dateFrom, dateTo
 */
router.get('/', authenticate, usersListValidation, validateRequest, userController.getUsersList);

/**
 * @route   GET /api/v1/users/overview
 * @desc    Get users overview/dashboard summary (admin/moderator only)
 * @access  Private (Admin/Moderator)
 */
router.get('/overview', authenticate, userController.getUsersOverview);

/**
 * @route   PUT /api/v1/users/:firebaseUid/role
 * @desc    Update user app role (admin only)
 * @access  Private (Admin)
 */
router.put('/:firebaseUid/role', authenticate, updateRoleValidation, validateRequest, userController.updateUserRole);

/**
 * @route   PUT /api/v1/users/:firebaseUid/deactivate
 * @desc    Deactivate user account (admin/moderator only)
 * @access  Private (Admin/Moderator)
 */
router.put('/:firebaseUid/deactivate', authenticate, userParamValidation, validateRequest, userController.deactivateUser);

/**
 * @route   DELETE /api/v1/users/:firebaseUid
 * @desc    Soft delete user (admin only)
 * @access  Private (Admin)
 */
router.delete('/:firebaseUid', authenticate, userParamValidation, validateRequest, userController.deleteUser);

/**
 * @route   DELETE /api/v1/users/:firebaseUid/permanent
 * @desc    Permanently delete user (admin only)
 * @access  Private (Admin)
 */
router.delete('/:firebaseUid/permanent', authenticate, userParamValidation, validateRequest, userController.permanentlyDeleteUser);

/**
 * @route   POST /api/v1/users/:firebaseUid/restore
 * @desc    Restore soft deleted user (admin only)
 * @access  Private (Admin)
 */
router.post('/:firebaseUid/restore', authenticate, userParamValidation, validateRequest, userController.restoreUser);

/**
 * @route   GET /api/v1/users/deleted
 * @desc    Get deleted users list (admin only)
 * @access  Private (Admin)
 */
router.get('/deleted', authenticate, usersListValidation, validateRequest, userController.getDeletedUsers);

/**
 * @route   GET /api/v1/users/stats
 * @desc    Get user statistics (admin/moderator only)
 * @access  Private (Admin/Moderator)
 */
router.get('/stats', authenticate, userController.getUserStats);

export { router as user };
