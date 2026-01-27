import crypto from 'crypto';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  AdminInitiateAuthCommand,
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

    const normalizedPhoneNumber = phoneNumber || phone || undefined;

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
};
