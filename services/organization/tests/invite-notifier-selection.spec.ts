import { describe, it, expect } from 'vitest';
import { EmailInviteNotifier, FakeInviteNotifier, selectInviteNotifier } from '../src/index.js';
import type { OrganizationEnvConfig } from '../src/config/env.js';

const base: OrganizationEnvConfig = { nodeEnv: 'development', port: 4002, appUrl: '', mongoUri: '', identityApiUrl: '', internalServiceKey: '' };

describe('D-AUTH-EMAIL D11: invite notifier selection', () => {
  it('keeps the recording stand-in in development, and sends real email when a provider is set', () => {
    expect(selectInviteNotifier(base)).toBeInstanceOf(FakeInviteNotifier);
    expect(selectInviteNotifier({ ...base, emailEnv: { EMAIL_PROVIDER: 'console' } })).toBeInstanceOf(EmailInviteNotifier);
  });

  it('sends real email in production and refuses to start without SMTP settings', () => {
    expect(() => selectInviteNotifier({ ...base, nodeEnv: 'production', emailEnv: {} })).toThrow(/SMTP_HOST is required/);
    expect(() => selectInviteNotifier({ ...base, nodeEnv: 'production', emailEnv: { EMAIL_PROVIDER: 'console' } })).toThrow(/not allowed in production/);
    const real = selectInviteNotifier({ ...base, nodeEnv: 'production', emailEnv: { SMTP_HOST: 'smtp.example.com', EMAIL_FROM: 'no-reply@example.com' } });
    expect(real).toBeInstanceOf(EmailInviteNotifier);
    expect(real.deliversForReal).toBe(true);
  });
});
