import { Router } from 'express';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';
import { requireAuth, requireCsrf } from '../../middlewares/index.js';
import { authController } from './auth.controller.js';
import {
  confirmValidator,
  forgotValidator,
  loginValidator,
  logoutValidator,
  oauthCallbackValidator,
  oauthStartValidator,
  refreshValidator,
  registerValidator,
  resendConfirmValidator,
  resetValidator,
} from './auth.validator.js';

const router = Router();

// POST /api/v1/auth/register
router.post('/register', registerValidator, validateRequest, authController.register);

// POST /api/v1/auth/confirm
router.post('/confirm', confirmValidator, validateRequest, authController.confirm);

// POST /api/v1/auth/login
router.post('/login', loginValidator, validateRequest, authController.login);

// POST /api/v1/auth/refresh
router.post(
  '/refresh',
  refreshValidator,
  validateRequest,
  requireCsrf(),
  authController.refresh
);

// POST /api/v1/auth/forgot
router.post('/forgot', forgotValidator, validateRequest, authController.forgot);

// POST /api/v1/auth/reset
router.post('/reset', resetValidator, validateRequest, authController.reset);

// POST /api/v1/auth/resend-confirm
router.post(
  '/resend-confirm',
  resendConfirmValidator,
  validateRequest,
  authController.resendConfirm
);

// POST /api/v1/auth/logout
router.post(
  '/logout',
  logoutValidator,
  validateRequest,
  requireCsrf(),
  authController.logout
);

// GET /api/v1/auth/csrf
router.get('/csrf', authController.csrf);

// GET /api/v1/auth/oauth/start?provider=Google|Microsoft
router.get(
  '/oauth/start',
  oauthStartValidator,
  validateRequest,
  authController.oauthStart
);

// GET /api/v1/auth/oauth/callback?code=...
router.get(
  '/oauth/callback',
  oauthCallbackValidator,
  validateRequest,
  authController.oauthCallback
);

// GET /api/v1/auth/me
router.get('/me', requireAuth(), authController.me);

export default router;
