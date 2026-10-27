import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../../src/application/auth.service';
import { FakeOAuthVerifier } from '../../src/application/oauth-verifier';
import { GoogleSignInService } from '../../src/application/google-sign-in.service';
import { PasswordAuthService } from '../../src/application/password-auth.service';
import { InMemoryPersonRepository } from '../../src/infrastructure/repositories/in-memory-person.repository';
import { InMemorySessionRepository } from '../../src/infrastructure/repositories/in-memory-session.repository';
import { InMemoryOtpRepository } from '../../src/infrastructure/repositories/in-memory-otp.repository';
import { InMemoryEmailCodeRepository, InMemoryKnownDeviceRepository } from '../../src/infrastructure/repositories/in-memory-email-code.repository';
import { ConsoleEmailSender, FakeOtpSender, FakeEventBus } from '@onebridge/shared';

describe('OAuth Route with Fake Verifier (Condition 5)', () => {
  let google: GoogleSignInService;
  let personRepo: InMemoryPersonRepository;

  beforeEach(() => {
    personRepo = new InMemoryPersonRepository();
    const events = new FakeEventBus();
    const auth = new AuthService({
      personRepo,
      sessionRepo: new InMemorySessionRepository(),
      otpRepo: new InMemoryOtpRepository(),
      otpSender: new FakeOtpSender(),
      eventBus: events,
      jwtSecret: 'test-secret-at-least-32-chars-long-12345',
    });
    const passwords = new PasswordAuthService({ persons: personRepo, codes: new InMemoryEmailCodeRepository(), devices: new InMemoryKnownDeviceRepository(), email: new ConsoleEmailSender('test'), auth, events, codeSecret: 's' });
    google = new GoogleSignInService(personRepo, passwords, auth, new FakeOAuthVerifier(false));
  });

  it('should authenticate via fake OAuth verifier and issue access and refresh tokens', async () => {
    const result = await google.signIn('mock-google-id-token-xyz', { deviceId: '', deviceLabel: 'Chrome Windows', ip: '127.0.0.1' });

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
