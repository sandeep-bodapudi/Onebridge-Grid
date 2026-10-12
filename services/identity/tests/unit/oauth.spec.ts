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

  it('should require re-auth and not return tokens or link provider when verified email matches existing person', async () => {
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

    // Account takeover closed: must not issue session or mutate authProviders silently
    expect(result.status).toBe('link_confirmation_required');
    expect(result.userId).toBe(existing.userId);
    expect(result.accessToken).toBeUndefined();
    expect(result.refreshToken).toBeUndefined();
    expect(result.linkTicket).toBeDefined();
    expect(result.maskedPhone).toBe('+91******3210');
    expect(result.message).toContain('Linking this OAuth provider requires re-authentication');

    const notLinkedYet = await personRepo.findById('usr-1');
    expect(notLinkedYet?.authProviders).not.toContain('google');

    // Confirm link with wrong code fails
    await expect(
      authService.confirmOAuthLink(result.linkTicket!, '999999', 'Chrome', '127.0.0.1')
    ).rejects.toThrow('Invalid OTP code');

    // Confirm link with correct OTP code succeeds and establishes session
    const confirmed = await authService.confirmOAuthLink(
      result.linkTicket!,
      '123456',
      'Chrome',
      '127.0.0.1'
    );
    expect(confirmed.status).toBe('authenticated');
    expect(confirmed.accessToken).toBeDefined();
    expect(confirmed.refreshToken).toBeDefined();

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

    expect(result.status).toBe('authenticated');
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.userId).toBeDefined();
    const created = await personRepo.findById(result.userId);
    expect(created).toBeDefined();
    expect(created?.authProviders).toContain('microsoft');
    expect(created?.email).toBe('newuser@microsoft.com');
  });

  it('should require re-auth and not return tokens or link provider when verified phone matches existing person', async () => {
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

    expect(result.status).toBe('link_confirmation_required');
    expect(result.userId).toBe(existing.userId);
    expect(result.accessToken).toBeUndefined();
    expect(result.refreshToken).toBeUndefined();
    expect(result.linkTicket).toBeDefined();

    const notLinkedYet = await personRepo.findById('usr-phone-user');
    expect(notLinkedYet?.authProviders).not.toContain('google');

    // Confirm link succeeds with primary phone OTP
    const confirmed = await authService.confirmOAuthLink(
      result.linkTicket!,
      '123456',
      'Chrome',
      '127.0.0.1'
    );
    expect(confirmed.status).toBe('authenticated');
    expect(confirmed.accessToken).toBeDefined();

    const updated = await personRepo.findById('usr-phone-user');
    expect(updated?.authProviders).toContain('google');
  });

  it('should authenticate directly if OAuth provider is already linked', async () => {
    await personRepo.create({
      userId: 'usr-already-linked',
      phone: '+919876543210',
      email: 'already@example.com',
      authProviders: ['google'],
      mfa: { enabled: false },
    });

    const result = await authService.handleOAuthLogin('google', {
      sub: 'google-sub-already',
      email: 'already@example.com',
      emailVerified: true,
      name: 'Already Linked',
    }, 'Chrome');

    expect(result.status).toBe('authenticated');
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.userId).toBe('usr-already-linked');
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
