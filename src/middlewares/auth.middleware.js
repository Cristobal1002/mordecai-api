import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { COOKIE_NAMES, parseCookies } from '../utils/cookies.js';

const region = process.env.COGNITO_REGION;
const userPoolId = process.env.COGNITO_USER_POOL_ID;
const clientId = process.env.COGNITO_CLIENT_ID;

if (!region || !userPoolId || !clientId) {
  throw new Error(
    'Missing env vars: COGNITO_REGION, COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID'
  );
}

const verifier = CognitoJwtVerifier.create({
  userPoolId,
  tokenUse: 'access',
  clientId,
});

export const requireAuth = () => async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization ?? '';
    const [type, token] = authHeader.split(' ');

    let authToken = null;

    if (type === 'Bearer' && token) {
      authToken = token;
    } else {
      const cookies = parseCookies(req.headers.cookie);
      authToken = cookies[COOKIE_NAMES.access];
    }

    if (!authToken) {
      return res.unauthorized('Unauthorized');
    }

    const payload = await verifier.verify(authToken);
    req.user = payload;
    return next();
  } catch {
    return res.unauthorized('Unauthorized');
  }
};
