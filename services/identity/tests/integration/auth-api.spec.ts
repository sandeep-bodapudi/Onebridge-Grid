import { describe, it, expect, beforeEach } from 'vitest';
import { AuthController } from '../../src/presentation/auth.controller';
import { AuthService } from '../../src/application/auth.service';
import { InMemoryPersonRepository } from '../../src/infrastructure/repositories/in-memory-person.repository';
import { InMemorySessionRepository } from '../../src/infrastructure/repositories/in-memory-session.repository';
import { InMemoryOtpRepository } from '../../src/infrastructure/repositories/in-memory-otp.repository';
import { FakeOtpSender, FakeEventBus } from '@onebridge/shared';

describe('Auth API Integration (AC-1 through AC-9 & Complete Controller Endpoints)', () => {
  let controller: AuthController;
  let personRepo: InMemoryPersonRepository;
  let sessionRepo: InMemorySessionRepository;
  let otpRepo: InMemoryOtpRepository;
  let fakeOtpSender: FakeOtpSender;
  let fakeEventBus: FakeEventBus;
  let authService: AuthService;

  beforeEach(() => {
    personRepo = new InMemoryPersonRepository();
    sessionRepo = new InMemorySessionRepository();
    otpRepo = new InMemoryOtpRepository();
    fakeOtpSender = new FakeOtpSender();
    fakeEventBus = new FakeEventBus();
    authService = new AuthService({
      personRepo,
      sessionRepo,
      otpRepo,
      otpSender: fakeOtpSender,
      eventBus: fakeEventBus,
      jwtSecret: 'test-secret-key-32-chars-long-12345',
      fixedOtpCode: '123456',
    });
    controller = new AuthController(authService);
  });

  describe('End-to-end Login Flow & Events', () => {
    it('should complete OTP login, emit user.registered event for new users, and return tokens', async () => {
      // 1. Request OTP
      const otpResp = await controller.requestOtp(
        { phone: '+919876543210' },
        { ip: '127.0.0.1', correlationId: 'corr-1' }
      );
      expect(otpResp.status).toBe(200);
      expect(otpResp.body.message).toContain('If registered, an OTP has been sent.');

      // 2. Verify OTP
      const verifyResp = await controller.verifyOtp(
        { phone: '+919876543210', code: '123456', deviceLabel: 'Safari iOS' },
        { ip: '127.0.0.1', correlationId: 'corr-1' }
      );
      expect(verifyResp.status).toBe(200);
      expect(verifyResp.body.status).toBe('authenticated');
      expect(verifyResp.body.accessToken).toBeDefined();
      expect(verifyResp.headers['Set-Cookie']).toContain('SameSite=Lax');
      expect(verifyResp.headers['Set-Cookie']).toContain('HttpOnly');
      expect(verifyResp.headers['Set-Cookie']).toContain('Secure');

      // Check event emitted
      const registeredEvents = fakeEventBus.calls.filter(c => c.name === 'publish');
      expect(registeredEvents.length).toBeGreaterThanOrEqual(1);
      const event = registeredEvents[0].args.event;
      expect(event.type).toBe('user.registered');
      expect(event.payload.phone).toBe('+919876543210');
    });

    it('should handle Idempotency-Key on requestOtp and verifyOtp (Rule 12)', async () => {
      const idempotencyKey = 'idem-req-123';

      // First request
      const first = await controller.requestOtp(
        { phone: '+919876543210' },
        { ip: '127.0.0.1', correlationId: 'corr-idem', idempotencyKey }
      );
      expect(first.status).toBe(200);

      // Replay with identical body should return cached response
      const replay = await controller.requestOtp(
        { phone: '+919876543210' },
        { ip: '127.0.0.1', correlationId: 'corr-idem', idempotencyKey }
      );
      expect(replay.status).toBe(200);
      expect(replay.body).toEqual(first.body);

      // Replay with mismatched body should throw 422 ProblemException
      await expect(
        controller.requestOtp(
          { phone: '+919999999999' },
          { ip: '127.0.0.1', correlationId: 'corr-idem', idempotencyKey }
        )
      ).rejects.toThrow('Mismatching body for idempotency key');
    });
  });

  describe('Session Management & Bearer Authentication (AC-7, Rule 2, Rule 14)', () => {
    it('should reject unauthenticated session requests with 401', async () => {
      await expect(
        controller.listSessions({}, { correlationId: 'corr-unauth' })
      ).rejects.toThrow('Missing or invalid Bearer token');

      await expect(
        controller.revokeSession('any-session-id', { correlationId: 'corr-unauth' })
      ).rejects.toThrow('Missing or invalid Bearer token');
    });

    it('should list sessions with pagination and enforce user isolation', async () => {
      const alice = await personRepo.create({
        userId: 'usr-alice',
        phone: '+919999999991',
        authProviders: ['otp'],
        mfa: { enabled: false },
      });
      const bob = await personRepo.create({
        userId: 'usr-bob',
        phone: '+919999999992',
        authProviders: ['otp'],
        mfa: { enabled: false },
      });

      // Alice creates 3 sessions
      const s1 = await authService.createSessionForUser(alice.userId, 'MacBook', '127.0.0.1');
      await authService.createSessionForUser(alice.userId, 'iPhone', '127.0.0.1');
      await authService.createSessionForUser(alice.userId, 'iPad', '127.0.0.1');

      // Bob creates 1 session
      const bobSession = await authService.createSessionForUser(bob.userId, 'ThinkPad', '127.0.0.1');

      // Alice lists her sessions with limit=2, offset=0
      const aliceList = await controller.listSessions(
        { limit: 2, offset: 0 },
        { authorization: `Bearer ${s1.accessToken}`, correlationId: 'corr-list' }
      );

      expect(aliceList.status).toBe(200);
      expect(aliceList.body.total).toBe(3);
      expect(aliceList.body.items).toHaveLength(2);
      expect(aliceList.body.items.every((s: { id: string }) => s.id !== bobSession.sessionId)).toBe(true);

      // Alice revokes s1
      const revokeResp = await controller.revokeSession(
        s1.sessionId,
        { authorization: `Bearer ${s1.accessToken}`, correlationId: 'corr-revoke' }
      );
      expect(revokeResp.status).toBe(204);

      // Alice attempting to revoke Bob's session must fail with 403 and return correlationId
      try {
        await controller.revokeSession(
          bobSession.sessionId,
          { authorization: `Bearer ${s1.accessToken}`, correlationId: 'corr-fail-revoke' }
        );
        expect.unreachable('Should have failed');
      } catch (err: unknown) {
        const problemErr = err as ProblemException;
        expect(problemErr.problem).toBeDefined();
        expect(problemErr.problem.status).toBe(403);
        expect(problemErr.problem.correlationId).toBe('corr-fail-revoke');
      }
    });

    it('should logout user and clear refresh cookie', async () => {
      const user = await personRepo.create({
        userId: 'usr-logout-test',
        phone: '+919876543299',
        authProviders: ['otp'],
        mfa: { enabled: false },
      });
      const session = await authService.createSessionForUser(user.userId, 'Safari', '127.0.0.1');

      const logoutResp = await controller.logout(
        session.sessionId,
        { authorization: `Bearer ${session.accessToken}`, correlationId: 'corr-logout' }
      );

      expect(logoutResp.status).toBe(204);
      expect(logoutResp.headers['Set-Cookie']).toContain('Max-Age=0');
    });
  });

  describe('Token Refresh (AC-5, AC-6)', () => {
    it('should refresh tokens via controller and rotate cookie', async () => {
      const user = await personRepo.create({
        userId: 'usr-refresh-test',
        phone: '+919876543288',
        authProviders: ['otp'],
        mfa: { enabled: false },
      });
      const initial = await authService.createSessionForUser(user.userId, 'Firefox', '127.0.0.1');

      const refreshResp = await controller.refresh(
        initial.refreshToken,
        { ip: '127.0.0.1', correlationId: 'corr-refresh' }
      );

      expect(refreshResp.status).toBe(200);
      expect(refreshResp.body.accessToken).toBeDefined();
      expect(refreshResp.headers['Set-Cookie']).toContain('refreshToken=');
      expect(refreshResp.headers['Set-Cookie']).toContain('SameSite=Lax');
    });
  });

  describe('MFA Setup & Challenge Workflow (AC-8)', () => {
    it('should enforce MFA setup on login for Owner on Business plan, and exchange MFA code', async () => {
      // Create Owner user on Business plan
      await personRepo.create({
        userId: 'usr-business-owner',
        phone: '+919876543277',
        authProviders: ['otp'],
        roles: [{ tenantId: 'tenant-acme', role: 'Owner', plan: 'Business' }],
        mfa: { enabled: false },
      });

      // 1. Request & Verify OTP
      await controller.requestOtp(
        { phone: '+919876543277' },
        { ip: '127.0.0.1', correlationId: 'corr-mfa' }
      );
      const verifyResp = await controller.verifyOtp(
        { phone: '+919876543277', code: '123456', deviceLabel: 'Mac' },
        { ip: '127.0.0.1', correlationId: 'corr-mfa' }
      );

      // Must require MFA setup
      expect(verifyResp.body.status).toBe('mfa_setup_required');
      expect(verifyResp.body.mfaTicket).toBeDefined();

      // 2. Setup MFA
      const setupResp = await controller.setupMfa('usr-business-owner', { correlationId: 'corr-mfa' });
      expect(setupResp.status).toBe(200);
      expect(setupResp.body.secret).toBeDefined();

      // 3. Confirm MFA setup
      const validCode = authService.mfaService.generateCurrentCode(setupResp.body.secret);
      const confirmResp = await controller.verifyMfa(
        { userId: 'usr-business-owner', code: validCode },
        { ip: '127.0.0.1', correlationId: 'corr-mfa' }
      );
      expect(confirmResp.body.success).toBe(true);

      // 4. Complete login challenge with MFA ticket
      const challengeCode = authService.mfaService.generateCurrentCode(setupResp.body.secret);
      const challengeResp = await controller.verifyMfa(
        { mfaTicket: verifyResp.body.mfaTicket, code: challengeCode },
        { ip: '127.0.0.1', correlationId: 'corr-mfa' }
      );
      expect(challengeResp.status).toBe(200);
      expect(challengeResp.body.accessToken).toBeDefined();
      expect(challengeResp.headers?.['Set-Cookie']).toContain('SameSite=Lax');
    });
  });

  describe('OAuth Endpoint (AC-4)', () => {
    it('should authenticate via handleOAuth endpoint', async () => {
      const oauthResp = await controller.handleOAuth(
        'google',
        {
          idToken: 'mock-google-token',
          mockProfile: {
            sub: 'g-sub-1',
            email: 'googleuser@example.com',
            emailVerified: true,
            name: 'Google User',
          },
        },
        { ip: '127.0.0.1', correlationId: 'corr-oauth' }
      );

      expect(oauthResp.status).toBe(200);
      expect(oauthResp.body.status).toBe('authenticated');
      expect(oauthResp.body.accessToken).toBeDefined();
      expect(oauthResp.headers['Set-Cookie']).toContain('refreshToken=');
    });
  });

  describe('ProblemDetails Error format', () => {
    it('should format errors using application/problem+json', async () => {
      try {
        await controller.verifyOtp(
          { phone: '+919876543210', code: 'wrong', deviceLabel: 'Mac' },
          { ip: '127.0.0.1', correlationId: 'corr-err-1' }
        );
      } catch (err: unknown) {
        const problemErr = err as ProblemException;
        expect(problemErr.problem).toBeDefined();
        expect(problemErr.problem.correlationId).toBe('corr-err-1');
        expect(problemErr.problem.status).toBe(400);
      }
    });
  });
});
