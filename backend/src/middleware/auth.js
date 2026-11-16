// Cognito JWT verification.
//
// The token the frontend sends is the ID token, not the access token: it is the one that
// carries email and name, and `aws-jwt-verify` checks the signature against the pool's
// public keys, which it downloads once and caches.
//
// AUTH_BYPASS is a local-development escape hatch. It exists because the Cognito pool is
// created by my teammate's CDK stack, and without it nobody can run the API on a laptop
// until that stack is deployed. It refuses to run when NODE_ENV is production, so a
// mis-set environment variable in Lambda cannot quietly open every route.

import { CognitoJwtVerifier } from 'aws-jwt-verify';

const bypassRequested = process.env.AUTH_BYPASS === 'true';
const isProduction = process.env.NODE_ENV === 'production';

export const authBypassed = bypassRequested && !isProduction;

if (bypassRequested && isProduction) {
  // Loud, because this is the one misconfiguration that would matter.
  console.error('AUTH_BYPASS=true was ignored: NODE_ENV is production.');
}

// Built once, lazily: with the bypass on there may be no pool to point at.
let verifier = null;

function getVerifier() {
  if (verifier) return verifier;

  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;

  if (!userPoolId || !clientId) {
    throw new Error(
      'COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID must be set (or AUTH_BYPASS=true for local dev).',
    );
  }

  verifier = CognitoJwtVerifier.create({ userPoolId, clientId, tokenUse: 'id' });
  return verifier;
}

/**
 * Rejects the request unless it carries a valid Cognito ID token.
 * On success `req.user` is { sub, email }.
 */
export async function requireAuth(req, res, next) {
  if (authBypassed) {
    req.user = { sub: 'local-dev-user', email: 'local@example.com' };
    return next();
  }

  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing Bearer token' });
  }

  try {
    const payload = await getVerifier().verify(token);
    req.user = { sub: payload.sub, email: payload.email };
    return next();
  } catch (error) {
    // The message from the library names the exact check that failed (expiry, audience,
    // signature). Useful in the log, not in the response.
    console.warn('token rejected:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
}
