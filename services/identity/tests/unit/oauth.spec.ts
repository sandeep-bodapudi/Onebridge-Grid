import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../../src/application/auth.service';
import { InMemoryPersonRepository } from '../../src/infrastructure/repositories/in-memory-person.repository';
import { InMemorySessionRepository } from '../../src/infrastructure/repositories/in-memory-session.repository';
import { InMemoryOtpRepository } from '../../src/infrastructure/repositories/in-memory-otp.repository';
import { FakeOtpSender, FakeEventBus } from '@onebridge/shared';

describe('OAuth Account Linking (AC-4)', () => {
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
    });
  });

  it('should link OAuth identity to existing person if verified email matches', async () => {
    // Seed an existing person with email
    const existing = await personRepo.create({
      userId: 'usr-1',
      phone: '+919876543210',
      email: 'sandeep@example.com',
      name: 'Sandeep',
      authProviders: ['otp'],
      mfa: { enabled: false },
    });

    const result = await authService.handleOAuthLogin('google', {
      sub: 'google-sub-123',
      email: 'sandeep@example.com',
      emailVerified: true,
      name: 'Sandeep G',
    }, 'Chrome');

    expect(result.userId).toBe(existing.userId);
    const updated = await personRepo.findById('usr-1');
    expect(updated?.authProviders).toContain('google');
  });

  it('should reject linking if email is unverified', async () => {
    await personRepo.create({
      userId: 'usr-1',
      phone: '+919876543210',
      email: 'sandeep@example.com',
      name: 'Sandeep',
      authProviders: ['otp'],
      mfa: { enabled: false },
    });

    await expect(authService.handleOAuthLogin('google', {
      sub: 'google-sub-999',
      email: 'sandeep@example.com',
      emailVerified: false,
      name: 'Sandeep Fake',
    }, 'Chrome')).rejects.toThrow('Cannot link unverified OAuth identity');
  });

  it('should create a new person if no matching email or phone exists', async () => {
    const result = await authService.handleOAuthLogin('microsoft', {
      sub: 'ms-sub-456',
      email: 'newuser@microsoft.com',
      emailVerified: true,
      name: 'New User',
    }, 'Edge');

    expect(result.userId).toBeDefined();
    const created = await personRepo.findById(result.userId);
    expect(created).toBeDefined();
    expect(created?.authProviders).toContain('microsoft');
    expect(created?.email).toBe('newuser@microsoft.com');
  });

  it('should link OAuth identity to existing person if verified phone matches', async () => {
    const existing = await personRepo.create({
      userId: 'usr-phone-user',
      phone: '+919876543210',
      authProviders: ['otp'],
      mfa: { enabled: false },
    });

    const result = await authService.handleOAuthLogin('google', {
      sub: 'google-sub-789',
      phone: '+919876543210',
      phoneVerified: true,
      name: 'Phone User',
    }, 'Chrome');

    expect(result.userId).toBe(existing.userId);
    const updated = await personRepo.findById('usr-phone-user');
    expect(updated?.authProviders).toContain('google');
  });

  it('should reject linking if phone is unverified', async () => {
    await personRepo.create({
      userId: 'usr-phone-user',
      phone: '+919876543210',
      authProviders: ['otp'],
      mfa: { enabled: false },
    });

    await expect(authService.handleOAuthLogin('google', {
      sub: 'google-sub-789',
      phone: '+919876543210',
      phoneVerified: false,
    }, 'Chrome')).rejects.toThrow('Cannot link unverified OAuth identity');
  });
});
