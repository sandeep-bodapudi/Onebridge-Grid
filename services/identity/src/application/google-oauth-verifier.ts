import { HttpException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { IOAuthVerifier, OAuthUserInfo } from './oauth-verifier.js';

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

function invalid(detail: string): HttpException {
  return new HttpException({ title: 'Unauthorized', detail, code: 'invalid_token' }, 401);
}

/**
 * D-AUTH-EMAIL (VPS plan A6): checks a Google Identity Services ID token against Google's
 * published keys, for our client ID only. An unverified Google email is refused.
 */
export class GoogleOAuthVerifier implements IOAuthVerifier {
  private readonly keys: JWTVerifyGetKey;

  /** `keys` is for tests (a local key set); production fetches and caches Google's keys. */
  constructor(private readonly clientId: string, keys?: JWTVerifyGetKey) {
    if (!clientId) throw new Error('GoogleOAuthVerifier needs GOOGLE_CLIENT_ID');
    this.keys = keys ?? createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  }

  async verifyIdToken(provider: 'google' | 'microsoft', idToken: string): Promise<OAuthUserInfo> {
    if (provider !== 'google') throw new HttpException({ title: 'Bad Request', detail: 'Only Google sign-in is available.', code: 'method_disabled' }, 400);
    if (typeof idToken !== 'string' || !idToken) throw invalid('Google did not send a sign-in token. Try again.');
    let payload: Record<string, unknown>;
    try {
      ({ payload } = await jwtVerify(idToken, this.keys, { issuer: GOOGLE_ISSUERS, audience: this.clientId, clockTolerance: 30 }));
    } catch {
      throw invalid('Google sign-in could not be checked. Try again.');
    }
    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const verified = payload.email_verified === true || payload.email_verified === 'true';
    if (!sub || !email) throw invalid('Google did not share an email address.');
    if (!verified) throw invalid('Your Google email is not verified. Verify it with Google, or sign up with email and password.');
    return { sub, email, emailVerified: true, name: typeof payload.name === 'string' ? payload.name : undefined };
  }
}
