import crypto from 'crypto';
import axios from 'axios';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  AdminInitiateAuthCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  ResendConfirmationCodeCommand,
  RevokeTokenCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  BadRequestError,
  ConflictError,
  UnauthorizedError,
} from '../../errors/index.js';
import { logger } from '../../utils/logger.js';

const region = process.env.COGNITO_REGION;
const userPoolId = process.env.COGNITO_USER_POOL_ID;
const clientId = process.env.COGNITO_CLIENT_ID;
const clientSecret = process.env.COGNITO_CLIENT_SECRET || null;
const cognitoDomain = process.env.COGNITO_DOMAIN || null;
const oauthRedirectUri = process.env.COGNITO_OAUTH_REDIRECT_URI || null;
const oauthScopes = process.env.COGNITO_OAUTH_SCOPES || 'openid email profile';
const oauthPrompt = process.env.COGNITO_OAUTH_PROMPT || null;
const frontendRedirectUri = process.env.COGNITO_FRONTEND_REDIRECT_URI || null;

if (!region || !userPoolId || !clientId) {
  throw new Error(
    'Missing env vars: COGNITO_REGION, COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID'
  );
}

if (!clientSecret) {
  logger.warn(
    'COGNITO_CLIENT_SECRET is not set. Proxy auth will only work for public app clients.'
  );
}

const cognitoClient = new CognitoIdentityProviderClient({ region });

const findUserByEmail = async (email) => {
  if (!email) {
    return null;
  }

  const command = new ListUsersCommand({
    UserPoolId: userPoolId,
    Filter: `email = "${email}"`,
    Limit: 1,
  });

  const result = await cognitoClient.send(command);
  return result.Users?.[0] || null;
};

const getExternalProviderByEmail = async (email) => {
  const user = await findUserByEmail(email);
  const identitiesValue = user?.Attributes?.find((attr) => attr.Name === 'identities')?.Value;

  if (!identitiesValue) {
    return null;
  }

  try {
    const identities = JSON.parse(identitiesValue);
    const providerName = identities?.[0]?.providerName;
    return providerName || null;
  } catch {
    return null;
  }
};

const normalizeDomain = (domain) => domain?.replace(/\/+$/, '');

const getOauthConfig = () => {
  const domain = normalizeDomain(cognitoDomain);

  if (!domain || !oauthRedirectUri) {
    throw new BadRequestError(
      'Missing OAuth configuration: COGNITO_DOMAIN and COGNITO_OAUTH_REDIRECT_URI'
    );
  }

  return {
    domain,
    redirectUri: oauthRedirectUri,
    scope: oauthScopes,
    frontendRedirectUri,
  };
};

const providerAliasMap = {
  google: 'Google',
  microsoft: 'Microsoft',
};

const resolveProvider = (provider) => {
  const alias = providerAliasMap[String(provider || '').toLowerCase()];

  if (!alias) {
    throw new BadRequestError('Unsupported provider. Use Google or Microsoft.');
  }

  return alias;
};

const secretHashFor = (username) => {
  if (!clientSecret) {
    return undefined;
  }

  return crypto
    .createHmac('sha256', clientSecret)
    .update(`${username}${clientId}`)
    .digest('base64');
};

const mapCognitoError = (error) => {
  const code = error?.name || 'UnknownError';
  const message = error?.message || 'Authentication error';

  switch (code) {
    case 'UsernameExistsException':
      throw new ConflictError('User already exists.');
    case 'InvalidPasswordException':
      throw new BadRequestError(message);
    case 'InvalidParameterException':
      throw new BadRequestError(message);
    case 'CodeMismatchException':
      throw new BadRequestError('Invalid confirmation code.');
    case 'ExpiredCodeException':
      throw new BadRequestError('Confirmation code expired.');
    case 'UserNotConfirmedException':
      throw new BadRequestError('User is not confirmed.');
    case 'NotAuthorizedException':
      throw new UnauthorizedError('Invalid credentials.');
    case 'UserNotFoundException':
      throw new UnauthorizedError('Invalid credentials.');
    default:
      logger.error({ err: error, code }, 'Unhandled Cognito error');
      throw new BadRequestError(message);
  }
};

const buildUserAttributes = ({ email, name, phoneNumber }) => {
  const attributes = [{ Name: 'email', Value: email }];

  if (name) {
    attributes.push({ Name: 'name', Value: name });
  }

  if (phoneNumber) {
    attributes.push({ Name: 'phone_number', Value: phoneNumber });
  }

  return attributes;
};

const normalizePhoneNumber = (value) => {
  if (!value || typeof value !== 'string') {
    return undefined;
  }
  return value.replace(/[\s()-]/g, '');
};

const normalizeAuthResult = (authenticationResult, fallback = {}) => {
  if (!authenticationResult) {
    return {
      ...fallback,
      tokens: null,
    };
  }

  return {
    ...fallback,
    tokens: {
      accessToken: authenticationResult.AccessToken,
      idToken: authenticationResult.IdToken,
      refreshToken: authenticationResult.RefreshToken,
      expiresIn: authenticationResult.ExpiresIn,
      tokenType: authenticationResult.TokenType,
    },
  };
};

const normalizeOauthTokens = (data, state) => ({
  state: state || null,
  tokens: {
    accessToken: data.access_token,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
    scope: data.scope,
  },
});

export const authService = {
  register: async ({
    email,
    password,
    name,
    phone,
    phoneNumber,
    acceptedTerms,
  }) => {
    if (!acceptedTerms) {
      throw new BadRequestError('You must accept the terms.');
    }

    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber || phone);

    const command = new SignUpCommand({
      ClientId: clientId,
      Username: email,
      Password: password,
      SecretHash: secretHashFor(email),
      UserAttributes: buildUserAttributes({
        email,
        name,
        phoneNumber: normalizedPhoneNumber,
      }),
    });

    try {
      const result = await cognitoClient.send(command);
      return {
        userSub: result.UserSub,
        userConfirmed: Boolean(result.UserConfirmed),
        nextStep: result.UserConfirmed ? 'DONE' : 'CONFIRM_SIGN_UP',
      };
    } catch (error) {
      if (error?.name === 'UsernameExistsException') {
        let provider = null;
        try {
          provider = await getExternalProviderByEmail(email);
        } catch (lookupError) {
          logger.warn({ err: lookupError }, 'Failed to resolve external provider by email');
        }
        if (provider) {
          throw new ConflictError(
            `You already signed up with ${provider}. Please use social login.`
          );
        }
        throw new ConflictError('User already exists.');
      }
      mapCognitoError(error);
    }
  },

  confirm: async ({ email, code }) => {
    const command = new ConfirmSignUpCommand({
      ClientId: clientId,
      Username: email,
      ConfirmationCode: code,
      SecretHash: secretHashFor(email),
    });

    try {
      await cognitoClient.send(command);
      return { confirmed: true };
    } catch (error) {
      mapCognitoError(error);
    }
  },

  login: async ({ email, password }) => {
    const command = new AdminInitiateAuthCommand({
      UserPoolId: userPoolId,
      AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
      ClientId: clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
        ...(clientSecret && { SECRET_HASH: secretHashFor(email) }),
      },
    });

    try {
      const result = await cognitoClient.send(command);

      if (result.ChallengeName) {
        return {
          challengeName: result.ChallengeName,
          challengeParameters: result.ChallengeParameters || {},
          tokens: null,
        };
      }

      return normalizeAuthResult(result.AuthenticationResult);
    } catch (error) {
      mapCognitoError(error);
    }
  },

  refresh: async ({ email, refreshToken }) => {
    if (clientSecret && !email) {
      throw new BadRequestError('Email is required to refresh tokens.');
    }

    const command = new AdminInitiateAuthCommand({
      UserPoolId: userPoolId,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: clientId,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
        ...(clientSecret && {
          SECRET_HASH: secretHashFor(email),
          USERNAME: email,
        }),
      },
    });

    try {
      const result = await cognitoClient.send(command);
      return normalizeAuthResult(result.AuthenticationResult);
    } catch (error) {
      mapCognitoError(error);
    }
  },

  forgotPassword: async ({ email }) => {
    const command = new ForgotPasswordCommand({
      ClientId: clientId,
      Username: email,
      SecretHash: secretHashFor(email),
    });

    try {
      const result = await cognitoClient.send(command);
      return {
        delivery: result.CodeDeliveryDetails || null,
      };
    } catch (error) {
      mapCognitoError(error);
    }
  },

  resetPassword: async ({ email, code, password }) => {
    const command = new ConfirmForgotPasswordCommand({
      ClientId: clientId,
      Username: email,
      ConfirmationCode: code,
      Password: password,
      SecretHash: secretHashFor(email),
    });

    try {
      await cognitoClient.send(command);
      return { reset: true };
    } catch (error) {
      mapCognitoError(error);
    }
  },

  resendConfirmation: async ({ email }) => {
    const command = new ResendConfirmationCodeCommand({
      ClientId: clientId,
      Username: email,
      SecretHash: secretHashFor(email),
    });

    try {
      const result = await cognitoClient.send(command);
      return { delivery: result.CodeDeliveryDetails || null };
    } catch (error) {
      mapCognitoError(error);
    }
  },

  logout: async ({ refreshToken }) => {
    if (!refreshToken) {
      throw new BadRequestError('refreshToken is required.');
    }

    const command = new RevokeTokenCommand({
      ClientId: clientId,
      Token: refreshToken,
      ...(clientSecret ? { ClientSecret: clientSecret } : {}),
    });

    try {
      await cognitoClient.send(command);
      return { revoked: true };
    } catch (error) {
      mapCognitoError(error);
    }
  },

  oauthStart: ({ provider, state }) => {
    const { domain, redirectUri, scope } = getOauthConfig();
    const identityProvider = resolveProvider(provider);

    const params = new URLSearchParams({
      identity_provider: identityProvider,
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      ...(oauthPrompt ? { prompt: oauthPrompt } : {}),
      ...(state ? { state } : {}),
    });

    return {
      authorizeUrl: `${domain}/oauth2/authorize?${params.toString()}`,
    };
  },

  oauthCallback: async ({ code, state }) => {
    const { domain, redirectUri } = getOauthConfig();

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      ...(clientSecret ? { client_secret: clientSecret } : {}),
    });

    try {
      const { data } = await axios.post(`${domain}/oauth2/token`, body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return normalizeOauthTokens(data, state);
    } catch (error) {
      const message =
        error?.response?.data?.error_description ||
        error?.response?.data?.error ||
        error.message ||
        'OAuth token exchange failed';

      logger.error({ err: error }, 'OAuth token exchange failed');
      throw new UnauthorizedError(message);
    }
  },
};
