import { describe, it, expect, afterEach } from 'vitest';
import { ConsoleEmailSender } from '@onebridge/shared';
import { EmailLeadNotifier } from '../src/infrastructure/email-lead-notifier.js';
import { BypassTurnstileValidator, CloudflareTurnstileValidator, RateLimitOnlyTurnstileValidator, selectTurnstileValidator } from '../src/application/turnstile-validator.js';
import { loadAndValidateEnv } from '../src/config/env.js';

const payload = { tenantId: 't1', ownerSeatId: 'seat-1', cardId: 'c1', leadId: 'lead-1', source: 'shareback', timestamp: new Date() };

describe('D-VPS-DEPLOY B1: lead emails', () => {
  it('emails the card owner a link to the dashboard and no lead details', async () => {
    const mail = new ConsoleEmailSender('test');
    const notifier = new EmailLeadNotifier(
      { findBySeatId: async () => ({ seatId: 'seat-1', tenantId: 't1', title: 'Sales', personId: 'p1', status: 'active', aggregateVersion: 1, updatedAt: '' }) },
      { emailOf: async (id) => (id === 'p1' ? 'owner@example.com' : undefined) },
      mail,
      'https://onebridgecard.com/dashboard'
    );
    expect(await notifier.send(payload)).toBe(true);
    const sent = mail.lastTo('owner@example.com')!;
    expect(sent.tag).toBe('new_lead');
    expect(sent.html).toContain('href="https://onebridgecard.com/dashboard"');
    expect(sent.text).not.toContain('lead-1');
  });

  it('skips seats without a person and never throws from notifyOwner', async () => {
    const mail = new ConsoleEmailSender('test');
    const empty = new EmailLeadNotifier({ findBySeatId: async () => null }, { emailOf: async () => 'x@example.com' }, mail, 'https://x/dashboard');
    expect(await empty.send(payload)).toBe(false);
    const broken = new EmailLeadNotifier(
      { findBySeatId: async () => { throw new Error('db down'); } },
      { emailOf: async () => undefined },
      mail,
      'https://x/dashboard'
    );
    await expect(broken.notifyOwner(payload)).resolves.toBeUndefined();
    expect(mail.sent).toHaveLength(0);
  });
});

describe('D-VPS-DEPLOY B1: Turnstile in production', () => {
  it('uses Cloudflare with a secret, rate limits only in production without one, and the test bypass elsewhere', async () => {
    expect(selectTurnstileValidator('production', 'secret')).toBeInstanceOf(CloudflareTurnstileValidator);
    expect(selectTurnstileValidator('production', undefined)).toBeInstanceOf(RateLimitOnlyTurnstileValidator);
    expect(selectTurnstileValidator('development', undefined)).toBeInstanceOf(BypassTurnstileValidator);
  });
});

describe('D-VPS-DEPLOY B1: cards secrets in production', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  const prod = () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'j'.repeat(48);
    process.env.INTERNAL_SERVICE_KEY = 'k'.repeat(48);
    process.env.REVALIDATION_SIGNING_SECRET = 'r'.repeat(48);
    process.env.ENCRYPTION_KEY = 'ab'.repeat(32);
    process.env.WEB_PUBLIC_URL = 'https://onebridgecard.com';
    delete process.env.SHORT_LINK_BASE_URL;
  };

  it('starts with real secrets and puts short links on the site itself', () => {
    prod();
    const env = loadAndValidateEnv();
    expect(env.shortLinkBaseUrl).toBe('https://onebridgecard.com/r');
    expect(env.encryptionKey).toBe('ab'.repeat(32));
  });

  it('refuses missing or development secrets', () => {
    for (const name of ['ENCRYPTION_KEY', 'INTERNAL_SERVICE_KEY', 'REVALIDATION_SIGNING_SECRET']) {
      prod();
      delete process.env[name];
      expect(() => loadAndValidateEnv(), name).toThrow(new RegExp(`${name} is required`));
    }
    prod();
    process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    expect(() => loadAndValidateEnv()).toThrow(/development default/);
  });
});
