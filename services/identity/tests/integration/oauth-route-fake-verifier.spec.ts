import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../../src/application/auth.service';
import { FakeOAuthVerifier } from '../../src/application/oauth-verifier';
import { InMemoryPersonRepository } from '../../src/infrastructure/repositories/in-memory-person.repository';
import { InMemorySessionRepository } from '../../src/infrastructure/repositories/in-memory-session.repository';
import { InMemoryOtpRepository } from '../../src/infrastructure/repositories/in-memory-otp.repository';
import { FakeOtpSender, FakeEventBus } from '@onebridge/shared';

describe('OAuth Route with Fake Verifier (Condition 5)', () => {
  let authService: AuthService;
  let personRepo: InMemoryPersonRepository;

  beforeEach(() => {
    personRepo = new InMemoryPersonRepository();
    const sessionRepo = new InMemorySessionRepository();
    const otpRepo = new InMemoryOtpRepository();
    const fakeVerifier = new FakeOAuthVerifier(false); // isProduction = false

    authService = new AuthService({
      personRepo,
      sessionRepo,
      otpRepo,
      otpSender: new FakeOtpSender(),
      eventBus: new FakeEventBus(),
      oauthVerifier: fakeVerifier,
      jwtSecret: 'test-secret-at-least-32-chars-long-12345',
    });
  });

  it('should authenticate via fake OAuth verifier and issue access and refresh tokens', async () => {
    const result = await authService.loginWithOAuth(
      'google',
      'mock-google-id-token-xyz',
      'Chrome Windows',
      '127.0.0.1'
    );

    expect(result.status).toBe('authenticated');
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.userId).toBeDefined();

    const person = await personRepo.findById(result.userId);
    expect(person).toBeDefined();
    expect(person?.email).toBe('oauth.user@example.com');
    expect(person?.authProviders).toContain('google');
  });

  it('should reject fake OAuth verifier in production mode', () => {
    expect(() => new FakeOAuthVerifier(true)).toThrowError(
      /FakeOAuthVerifier is strictly forbidden in production/
    );
  });
});
