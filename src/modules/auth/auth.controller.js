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
import { getAuthIdentity } from '../../utils/auth-identity.js';
import { userService } from '../users/user.service.js';
import { logger } from '../../utils/logger.js';

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
        return res.unauthorized('Session expired. Please sign in again.');
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

  checkAuthMethod: async (req, res, next) => {
    try {
      const { email } = req.query;
      const result = await authService.checkAuthMethod({ email });
      return res.ok(result, 'Auth method checked');
    } catch (error) {
      return next(error);
    }
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
      const { code, state, error, error_description: errorDescription } = req.query;
      const redirectUri = process.env.COGNITO_FRONTEND_REDIRECT_URI || null;

      if (error) {
        if (!redirectUri) {
          return res.badRequest(
            typeof errorDescription === 'string'
              ? errorDescription
              : String(error)
          );
        }

        const url = new URL(redirectUri);
        const params = new URLSearchParams({
          oauth: 'failed',
          ...(typeof error === 'string' ? { error } : {}),
          ...(typeof errorDescription === 'string'
            ? { error_description: errorDescription }
            : {}),
          ...(state ? { state } : {}),
        });

        url.search = params.toString();
        return res.redirect(url.toString());
      }

      const result = await authService.oauthCallback({ code, state });
      const csrfToken = generateCsrfToken();
      const idPayload = decodeJwtPayload(result.tokens?.idToken);

      // If user has ONLY native (password) account, require them to use that instead of OAuth.
      // If they have both (duplicate), allow OAuth since they just authenticated with it.
      if (redirectUri && idPayload) {
        const email =
          idPayload?.email ||
          idPayload?.['cognito:username'] ||
          idPayload?.username ||
          null;
        if (email) {
          try {
            const { hasNative, method } = await authService.checkAuthMethod({
              email: String(email).trim(),
            });
            if (hasNative && method === 'password') {
              const url = new URL(redirectUri);
              url.searchParams.set('oauth', 'use_password');
              return res.redirect(url.toString());
            }
          } catch (err) {
            logger.warn({ err }, '[OAuth] checkAuthMethod failed, continuing');
          }
        }
      }

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
      logger.info(
        {
          idPayloadKeys: idPayload ? Object.keys(idPayload) : [],
          idPayload,
          phoneInIdToken: {
            phone_number: idPayload?.phone_number,
            phone: idPayload?.phone,
          },
        },
        '[OAuth] idToken payload (raw from Cognito)'
      );

      const userInfo = await authService.oauthFetchUserInfo(
        result.tokens?.accessToken
      );
      logger.info(
        {
          userInfoKeys: userInfo ? Object.keys(userInfo) : [],
          userInfo,
          phoneFields: {
            idPayload_phone_number: idPayload?.phone_number,
            idPayload_phone: idPayload?.phone,
            userInfo_phone_number: userInfo?.phone_number,
            userInfo_phone: userInfo?.phone,
          },
        },
        '[OAuth] UserInfo from Cognito (raw)'
      );

      const fromSource = (id, userInfoKey) =>
        idPayload?.[id] ?? userInfo?.[userInfoKey ?? id] ?? null;

      const email =
        fromSource('email') ||
        fromSource('cognito:username', 'username') ||
        fromSource('username') ||
        null;

      const fullNameFromToken =
        fromSource('name') ||
        (fromSource('given_name') && fromSource('family_name')
          ? `${fromSource('given_name')} ${fromSource('family_name')}`.trim()
          : null) ||
        fromSource('given_name') ||
        fromSource('family_name') ||
        null;

      const phoneFromToken = fromSource('phone_number');

      const identity = {
        sub: idPayload?.sub || userInfo?.sub || null,
        email: typeof email === 'string' ? email.trim().toLowerCase() : null,
        fullName: fullNameFromToken,
        phone: phoneFromToken,
      };
      logger.info({ identity }, '[OAuth] Built identity for user');

      let user = await userService.getUserByAuth(identity);
      if (!user && identity.email) {
        user = await userService.findByEmail(identity.email);
      }
      if (user) {
        logger.info(
          { userId: user.id, fullName: user.fullName, phone: user.phone },
          '[OAuth] Existing user found (no create)'
        );
      }
      if (!user && identity.sub) {
        user = await userService.ensureUserFromAuth(identity);
        logger.info(
          {
            userId: user?.id,
            fullName: user?.fullName,
            phone: user?.phone,
          },
          '[OAuth] User after ensureUserFromAuth'
        );
      }
      const memberships = user
        ? await userService.listMemberships(user.id)
        : [];
      const hasFullName = Boolean(
        user?.fullName && String(user.fullName).trim()
      );
      const hasPhone = Boolean(user?.phone && String(user.phone).trim());
      const hasCompany = memberships.length > 0;
      const needsOnboarding =
        !user || !hasFullName || !hasPhone || !hasCompany;

      const url = new URL(redirectUri);
      const params = new URLSearchParams({
        success: '1',
        csrfToken,
        needsOnboarding: needsOnboarding ? '1' : '0',
        ...(result.state ? { state: result.state } : {}),
      });

      url.search = params.toString();
      return res.redirect(url.toString());
    } catch (error) {
      logger.error({ err: error }, 'OAuth callback error');
      const redirectUri = process.env.COGNITO_FRONTEND_REDIRECT_URI;
      if (redirectUri) {
        const url = new URL(redirectUri);
        url.searchParams.set('oauth', 'failed');
        return res.redirect(url.toString());
      }
      return next(error);
    }
  },

  me: async (req, res) => {
    const cookies = parseCookies(req.headers.cookie || '');
    logger.info(
      {
        hasCookieHeader: Boolean(req.headers.cookie),
        cookieNames: req.headers.cookie ? Object.keys(cookies) : [],
        hasIdCookie: Boolean(cookies[COOKIE_NAMES.id]),
        hasAccessCookie: Boolean(cookies[COOKIE_NAMES.access]),
      },
      '[Auth/me] Cookie debug'
    );

    const idToken = cookies[COOKIE_NAMES.id];
    const idPayload = decodeJwtPayload(idToken);
    logger.info(
      {
        idPayloadKeys: idPayload ? Object.keys(idPayload) : [],
        idPayloadFull: idPayload ?? null,
        phoneInIdToken: {
          phone_number: idPayload?.phone_number,
          phone: idPayload?.phone,
        },
      },
      '[Auth/me] idPayload (raw from Cognito id_token)'
    );
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

    let identity = getAuthIdentity(req);
    if (!identity.fullName || !identity.phone) {
      const accessToken =
        cookies[COOKIE_NAMES.access] ||
        (req.headers.authorization?.startsWith('Bearer ')
          ? req.headers.authorization.slice(7)
          : null);
      if (accessToken) {
        try {
          const userInfo = await authService.oauthFetchUserInfo(accessToken);
          if (userInfo) {
            const fullNameFromUserInfo =
              userInfo.name ||
              (userInfo.given_name && userInfo.family_name
                ? `${userInfo.given_name} ${userInfo.family_name}`.trim()
                : null) ||
              userInfo.given_name ||
              userInfo.family_name ||
              null;
            identity = {
              ...identity,
              fullName: identity.fullName || fullNameFromUserInfo,
              phone: identity.phone || userInfo.phone_number || null,
            };
            logger.info(
              {
                userInfoKeys: Object.keys(userInfo),
                userInfoFull: userInfo,
                phoneFields: {
                  idPayload_phone_number: idPayload?.phone_number,
                  idPayload_phone: idPayload?.phone,
                  userInfo_phone_number: userInfo.phone_number,
                  userInfo_phone: userInfo.phone,
                },
                identity,
              },
              '[Auth/me] UserInfo (raw from Cognito /oauth2/userInfo)'
            );
          }
        } catch (err) {
          logger.warn({ err }, '[Auth/me] UserInfo fetch failed, using token identity');
        }
      }
    }
    logger.info({ identity }, '[Auth/me] Identity from tokens');
    let user = await userService.getUserByAuth(identity);
    if (!user && identity?.email) {
      user = await userService.findByEmail(identity.email);
    }
    if (!user && identity?.sub) {
      user = await userService.ensureUserFromAuth(identity);
    } else if (
      user &&
      identity?.sub &&
      (identity.fullName || identity.phone)
    ) {
      user = await userService.ensureUserFromAuth(identity);
    }
    const memberships = user
      ? await userService.listMemberships(user.id)
      : [];
    const hasFullName = Boolean(
      user?.fullName && String(user.fullName).trim()
    );
    const hasPhone = Boolean(user?.phone && String(user.phone).trim());
    const hasCompany = memberships.length > 0;
    const needsOnboarding =
      !user ||
      !hasFullName ||
      !hasPhone ||
      !hasCompany;

    const primaryTenant = memberships[0]?.tenant;
    const companyName = primaryTenant?.name ?? null;

    const userResponse = {
      ...req.user,
      ...(email && { email }),
      ...(username && { username }),
      fullName: user?.fullName ?? identity?.fullName ?? null,
      phone: user?.phone ?? identity?.phone ?? null,
      companyName,
    };
    logger.info(
      { userResponse, dbUser: user ? { fullName: user.fullName, phone: user.phone } : null },
      '[Auth/me] Returning user data'
    );

    return res.ok(
      {
        user: userResponse,
        userExists: Boolean(user),
        needsOnboarding,
        memberships,
      },
      'Authenticated user'
    );
  },

  updateMe: async (req, res, next) => {
    try {
      const identity = getAuthIdentity(req);
      const updated = await userService.updateProfile(identity, req.body);
      if (!updated) {
        return res.forbidden('User not found');
      }
      return res.ok(
        {
          user: {
            ...req.user,
            fullName: updated.fullName ?? null,
            phone: updated.phone ?? null,
          },
        },
        'Profile updated'
      );
    } catch (error) {
      return next(error);
    }
  },
};
