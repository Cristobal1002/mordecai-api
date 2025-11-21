import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate-request.middleware.js';
import {
  registerValidation,
  loginValidation,
  googleLoginValidation,
  refreshTokenValidation,
  passwordResetValidation,
  verifyEmailValidation,
} from '../validators/auth.validator.js';

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user with email and password
 * @access  Public
 */
router.post('/register', registerValidation, validateRequest, authController.register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login with email and password
 * @access  Public
 */
router.post('/login', loginValidation, validateRequest, authController.login);

/**
 * @route   POST /api/v1/auth/google
 * @desc    Login/Register with Google
 * @access  Public
 */
router.post('/google', googleLoginValidation, validateRequest, authController.googleLogin);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', refreshTokenValidation, validateRequest, authController.refreshToken);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, authController.getCurrentUser);

/**
 * @route   POST /api/v1/auth/password-reset
 * @desc    Send password reset email
 * @access  Public
 */
router.post('/password-reset', passwordResetValidation, validateRequest, authController.sendPasswordReset);

/**
 * @route   POST /api/v1/auth/verify-email
 * @desc    Verify email address
 * @access  Public
 */
router.post('/verify-email', verifyEmailValidation, validateRequest, authController.verifyEmail);

export { router as auth };
