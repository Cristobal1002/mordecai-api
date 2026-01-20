import { CognitoJwtVerifier } from 'aws-jwt-verify';

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

    if (type !== 'Bearer' || !token) {
      return res.unauthorized('Unauthorized');
    }

    const payload = await verifier.verify(token);
    req.user = payload;
    return next();
  } catch {
    return res.unauthorized('Unauthorized');
  }
};
