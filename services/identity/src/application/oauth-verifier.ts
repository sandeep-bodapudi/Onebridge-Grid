export interface OAuthUserInfo {
  email: string;
  name: string;
  sub: string;
  emailVerified: boolean;
}

export interface IOAuthVerifier {
  verifyIdToken(provider: 'google' | 'microsoft', idToken: string): Promise<OAuthUserInfo>;
}

export class FakeOAuthVerifier implements IOAuthVerifier {
  constructor(private isProduction: boolean) {
    if (this.isProduction) {
      throw new Error('FakeOAuthVerifier is strictly forbidden in production');
    }
  }

  async verifyIdToken(provider: 'google' | 'microsoft', idToken: string): Promise<OAuthUserInfo> {
    if (this.isProduction) {
      throw new Error('FakeOAuthVerifier cannot be invoked in production');
    }

    if (!idToken || idToken.trim() === '') {
      throw new Error('idToken is required');
    }

    // Predefined test fixtures or encoded tokens
    if (idToken === 'invalid-token' || idToken === 'expired-token') {
      throw new Error('Invalid or expired OAuth token');
    }

    // Default mock user for tests
    return {
      email: 'oauth.user@example.com',
      name: 'OAuth User',
      sub: `mock-sub-${provider}-${idToken.substring(0, 8)}`,
      emailVerified: true,
    };
  }
}
