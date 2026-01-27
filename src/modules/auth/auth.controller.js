import { authService } from './auth.service.js';
import {
  clearAuthCookies,
  clearCsrfCookie,
  generateCsrfToken,
  setAuthCookies,
  setCsrfCookie,
} from './auth.cookies.js';
import { BadRequestError } from '../../errors/index.js';
import { COOKIE_NAMES, parseCookies } from '../../utils/cookies.js';
import { decodeJwtPayload } from '../../utils/jwt.js';

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
      if (result.tokens) {
        setAuthCookies(res, result.tokens);
        const csrfToken = generateCsrfToken();
        setCsrfCookie(res, csrfToken);
        return res.ok(
          { ...result, csrfToken },
          'Login successful'
        );
      }
      return res.ok(result, 'Login successful');
    } catch (error) {
      return next(error);
    }
  },

  refresh: async (req, res, next) => {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const refreshToken =
        req.body.refreshToken || cookies[COOKIE_NAMES.refresh];

      if (!refreshToken) {
        throw new BadRequestError('refreshToken is required.');
      }

      const idToken = cookies[COOKIE_NAMES.id];
      const idPayload = decodeJwtPayload(idToken);
      const email =
        req.body.email ||
        idPayload?.email ||
        idPayload?.['cognito:username'] ||
        idPayload?.username;

      const result = await authService.refresh({
        email,
        refreshToken,
      });

      if (result.tokens) {
        setAuthCookies(res, result.tokens);
        const csrfToken = generateCsrfToken();
        setCsrfCookie(res, csrfToken);
        return res.ok(
          { ...result, csrfToken },
          'Token refreshed'
        );
      }

      return res.ok(result, 'Token refreshed');
    } catch (error) {
      return next(error);
    }
  },

  forgot: async (req, res, next) => {
    try {
      const result = await authService.forgotPassword(req.body);
      return res.ok(result, 'Password reset code sent');
    } catch (error) {
      return next(error);
    }
  },

  reset: async (req, res, next) => {
    try {
      const result = await authService.resetPassword(req.body);
      return res.ok(result, 'Password reset');
    } catch (error) {
      return next(error);
    }
  },

  resendConfirm: async (req, res, next) => {
    try {
      const result = await authService.resendConfirmation(req.body);
      return res.ok(result, 'Confirmation code resent');
    } catch (error) {
      return next(error);
    }
  },

  logout: async (req, res, next) => {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const refreshToken =
        req.body.refreshToken || cookies[COOKIE_NAMES.refresh];

      if (!refreshToken) {
        throw new BadRequestError('refreshToken is required.');
      }

      const result = await authService.logout({ refreshToken });
      clearAuthCookies(res);
      clearCsrfCookie(res);
      return res.ok(result, 'Logged out');
    } catch (error) {
      return next(error);
    }
  },

  csrf: (_req, res) => {
    const csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);
    return res.ok({ csrfToken }, 'CSRF token issued');
  },

  oauthStart: (req, res, next) => {
    try {
      const { provider, state } = req.query;
      const { authorizeUrl } = authService.oauthStart({ provider, state });
      return res.redirect(authorizeUrl);
    } catch (error) {
      return next(error);
    }
  },

  oauthCallback: async (req, res, next) => {
    try {
      const { code, state } = req.query;
      const result = await authService.oauthCallback({ code, state });
      const redirectUri = process.env.COGNITO_FRONTEND_REDIRECT_URI || null;
      const csrfToken = generateCsrfToken();

      if (result.tokens) {
        setAuthCookies(res, result.tokens);
        setCsrfCookie(res, csrfToken);
      }

      if (!redirectUri) {
        return res.ok(
          { ...result, csrfToken },
          'OAuth login successful'
        );
      }

      const url = new URL(redirectUri);
      const params = new URLSearchParams({
        success: '1',
        csrfToken,
        ...(result.state ? { state: result.state } : {}),
      });

      url.search = params.toString();
      return res.redirect(url.toString());
    } catch (error) {
      return next(error);
    }
  },

  me: async (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const idToken = cookies[COOKIE_NAMES.id];
    const idPayload = decodeJwtPayload(idToken);
    const email =
      req.user?.email ||
      idPayload?.email ||
      idPayload?.['cognito:username'] ||
      idPayload?.username ||
      null;
    const username =
      req.user?.username ||
      idPayload?.['cognito:username'] ||
      idPayload?.username ||
      null;

    return res.ok(
      {
        user: {
          ...req.user,
          ...(email && { email }),
          ...(username && { username }),
        },
      },
      'Authenticated user'
    );
  },
};
