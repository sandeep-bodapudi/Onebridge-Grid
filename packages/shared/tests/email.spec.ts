import { describe, it, expect, vi } from 'vitest';
import {
  ConsoleEmailSender,
  SmtpEmailSender,
  createEmailSender,
  renderEmail,
  maskEmail,
  assertNotFakeInProduction,
  FakeOtpSender,
  type MailTransport,
} from '../src/index';

describe('D-AUTH-EMAIL email sending', () => {
  it('renders a code email in English and Hindi, with the code, expiry and no links', () => {
    const en = renderEmail('verification_code', 'meera@example.com', { code: '482913', name: 'Meera' });
    expect(en.subject).toBe('482913 is your OneBridge verification code');
    expect(en.text).toContain('482913');
    expect(en.text).toContain('10 minutes');
    expect(en.text).toContain("If this wasn't you");
    expect(en.html).toContain('482913');
    expect(en.html).not.toMatch(/<a\s/i);
    expect(en.tag).toBe('verification_code');

    const hi = renderEmail('verification_code', 'meera@example.com', { code: '482913' }, 'hi');
    expect(hi.subject).toContain('सत्यापन कोड');
    expect(hi.text).toContain('10 मिनट');
  });

  it('escapes names and device labels in HTML', () => {
    const m = renderEmail('new_device_sign_in', 'a@example.com', { name: '<b>x</b>', device: 'Chrome "on" <Windows>' });
    expect(m.html).not.toContain('<b>x</b>');
    expect(m.html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(m.html).toContain('&lt;Windows&gt;');
  });

  it('renders every security template without a code', () => {
    for (const t of ['signup_on_existing_account', 'new_device_sign_in', 'password_changed', 'google_linked'] as const) {
      const m = renderEmail(t, 'a@example.com');
      expect(m.subject.length).toBeGreaterThan(5);
      expect(m.html).not.toMatch(/<a\s/i);
    }
  });

  it('masks emails for logs and screens', () => {
    expect(maskEmail('meera@example.com')).toBe('m•••@example.com');
    expect(maskEmail('bad')).toBe('•••');
  });

  it('refuses the console sender in production and needs SMTP settings', () => {
    expect(() => createEmailSender({ EMAIL_PROVIDER: 'console' }, 'production')).toThrow(/not allowed in production/);
    expect(() => createEmailSender({}, 'production')).toThrow(/SMTP_HOST is required/);
    expect(() => createEmailSender({ SMTP_HOST: 'smtp.example.com' }, 'production')).toThrow(/EMAIL_FROM is required/);
    expect(createEmailSender({ SMTP_HOST: 'smtp.example.com', EMAIL_FROM: 'no-reply@example.com' }, 'production')).toBeInstanceOf(SmtpEmailSender);
    expect(createEmailSender({}, 'development')).toBeInstanceOf(ConsoleEmailSender);
    expect(() => createEmailSender({ EMAIL_PROVIDER: 'pigeon' }, 'development')).toThrow(/Unknown EMAIL_PROVIDER/);
  });

  it('console sender keeps messages for tests and logs only the masked address outside development', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const sender = new ConsoleEmailSender('production-like');
    await sender.send(renderEmail('login_code', 'meera@example.com', { code: '111222' }));
    expect(sender.lastTo('meera@example.com')?.text).toContain('111222');
    const printed = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(printed).not.toContain('meera@example.com');
    expect(printed).not.toContain('111222');
    log.mockRestore();
  });

  it('SMTP sender sends through the transport and retries once on a transient error', async () => {
    const calls: Record<string, unknown>[] = [];
    let fail = 1;
    const transport: MailTransport = {
      async sendMail(mail) {
        calls.push(mail);
        if (fail-- > 0) throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
        return { messageId: 'm-1' };
      },
    };
    const sender = new SmtpEmailSender({ host: 'h', port: 587, secure: false, from: 'no-reply@example.com', replyTo: 'support@example.com' }, transport);
    const res = await sender.send(renderEmail('password_changed', 'a@example.com'));
    expect(res.id).toBe('m-1');
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ from: 'no-reply@example.com', replyTo: 'support@example.com', to: 'a@example.com' });
  });

  it('SMTP sender does not retry a permanent error and hides the address in the error', async () => {
    let count = 0;
    const transport: MailTransport = {
      async sendMail() {
        count++;
        throw Object.assign(new Error('mailbox unavailable meera@example.com'), { responseCode: 550 });
      },
    };
    const sender = new SmtpEmailSender({ host: 'h', port: 587, secure: false, from: 'f@example.com' }, transport);
    const err = await sender.send(renderEmail('password_changed', 'meera@example.com')).catch((e: Error) => e);
    expect(count).toBe(1);
    expect(String(err)).not.toContain('meera@example.com');
  });

  it('refuses stand-in adapters in production only', () => {
    expect(() => assertNotFakeInProduction('OTP sender', new FakeOtpSender(), 'production')).toThrow(/not allowed in production/);
    expect(() => assertNotFakeInProduction('Email', new ConsoleEmailSender('test'), 'production')).toThrow(/ConsoleEmailSender/);
    expect(() => assertNotFakeInProduction('OTP sender', new FakeOtpSender(), 'development')).not.toThrow();
    expect(() => assertNotFakeInProduction('Email', new SmtpEmailSender({ host: 'h', port: 1, secure: false, from: 'f' }), 'production')).not.toThrow();
  });
});
