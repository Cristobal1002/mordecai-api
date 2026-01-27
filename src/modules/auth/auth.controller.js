import { authService } from './auth.service.js';

export const authController = {
  register: async (req, res, next) => {
    try {
      const result = await authService.register(req.body);
      return res.created(result, 'User registered');
    } catch (error) {
      return next(error);
    }
  },

  confirm: async (req, res, next) => {
    try {
      const result = await authService.confirm(req.body);
      return res.ok(result, 'User confirmed');
    } catch (error) {
      return next(error);
    }
  },

  login: async (req, res, next) => {
    try {
      const result = await authService.login(req.body);
      return res.ok(result, 'Login successful');
    } catch (error) {
      return next(error);
    }
  },

  refresh: async (req, res, next) => {
    try {
      const result = await authService.refresh(req.body);
      return res.ok(result, 'Token refreshed');
    } catch (error) {
      return next(error);
    }
  },

  me: async (req, res) => {
    return res.ok(
      {
        user: req.user,
      },
      'Authenticated user'
    );
  },
};

