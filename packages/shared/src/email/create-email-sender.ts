import { ConsoleEmailSender } from './console-email-sender.js';
import { EmailSender } from './email-sender.js';
import { SmtpEmailSender } from './smtp-email-sender.js';

/**
 * EMAIL_PROVIDER=console|smtp. Development and tests default to console; production
 * must use smtp, and a console sender refuses to start there (D-AUTH-EMAIL D1).
 */
export function createEmailSender(env: Record<string, string | undefined>, nodeEnv: string): EmailSender {
  const provider = (env.EMAIL_PROVIDER || (nodeEnv === 'production' ? 'smtp' : 'console')).trim().toLowerCase();
  if (provider === 'console') {
    if (nodeEnv === 'production') throw new Error('EMAIL_PROVIDER=console is not allowed in production; set EMAIL_PROVIDER=smtp');
    return new ConsoleEmailSender(nodeEnv);
  }
  if (provider !== 'smtp') throw new Error(`Unknown EMAIL_PROVIDER "${provider}" (use console or smtp)`);
  const host = (env.SMTP_HOST || '').trim();
  const from = (env.EMAIL_FROM || '').trim();
  if (!host) throw new Error('SMTP_HOST is required when EMAIL_PROVIDER=smtp');
  if (!from) throw new Error('EMAIL_FROM is required when EMAIL_PROVIDER=smtp');
  const port = parseInt(env.SMTP_PORT || '587', 10);
  return new SmtpEmailSender({
    host,
    port,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465,
    user: env.SMTP_USER || undefined,
    password: env.SMTP_PASSWORD || undefined,
    from,
    replyTo: env.EMAIL_REPLY_TO || undefined,
  });
}
