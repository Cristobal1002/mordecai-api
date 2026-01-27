import { Router } from 'express';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';
import { requireAuth } from '../../middlewares/index.js';
import { authController } from './auth.controller.js';
import {
  confirmValidator,
  loginValidator,
  refreshValidator,
  registerValidator,
} from './auth.validator.js';

const router = Router();

// POST /api/v1/auth/register
router.post('/register', registerValidator, validateRequest, authController.register);

// POST /api/v1/auth/confirm
router.post('/confirm', confirmValidator, validateRequest, authController.confirm);

// POST /api/v1/auth/login
router.post('/login', loginValidator, validateRequest, authController.login);

// POST /api/v1/auth/refresh
router.post('/refresh', refreshValidator, validateRequest, authController.refresh);

// GET /api/v1/auth/me
router.get('/me', requireAuth(), authController.me);

export default router;

