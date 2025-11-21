import { authService } from '../services/auth.service.js';
import { userService } from '../services/user.service.js';
import { logger } from '../utils/logger.js';

class AuthController {
  async register(req, res, next) {
    try {
      const result = await authService.registerWithEmail(req.body);
      
      logger.info(
        { userId: result.user.id, email: result.user.email },
        'User registered successfully'
      );
      
      res.created({
        message: 'User registered successfully',
        data: {
          user: result.user,
          tokens: result.tokens,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await authService.loginWithEmail(email, password);
      
      logger.info(
        { userId: result.user.id, email: result.user.email },
        'User logged in successfully'
      );
      
      res.success({
        message: 'Login successful',
        data: {
          user: result.user,
          tokens: result.tokens,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async googleLogin(req, res, next) {
    try {
      const { idToken } = req.body;
      const result = await authService.loginWithGoogle(idToken);
      
      logger.info(
        { userId: result.user.id, email: result.user.email },
        'User logged in with Google successfully'
      );
      
      res.success({
        message: 'Google login successful',
        data: {
          user: result.user,
          tokens: result.tokens,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);
      
      res.success({
        message: 'Token refreshed successfully',
        data: {
          user: result.user,
          tokens: result.tokens,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const result = await authService.logout(req.firebaseUid);
      
      logger.info(
        { userId: req.userId },
        'User logged out successfully'
      );
      
      res.success({
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser(req, res, next) {
    try {
      // Get complete user profile (PostgreSQL + Firebase data)
      const userProfile = await userService.getUserProfile(req.firebaseUid);
      
      res.success({
        message: 'User retrieved successfully',
        data: {
          user: userProfile,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async sendPasswordReset(req, res, next) {
    try {
      const { email } = req.body;
      const result = await authService.sendPasswordResetEmail(email);
      
      res.success({
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req, res, next) {
    try {
      const { idToken } = req.body;
      const result = await authService.verifyEmail(idToken);
      
      res.success({
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
