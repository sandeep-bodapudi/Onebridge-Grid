import nodemailer from 'nodemailer';
import { EmailMessage, EmailSender, maskEmail } from './email-sender.js';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
  replyTo?: string;
}

/** The part of a nodemailer transport this adapter uses (tests pass a fake). */
export interface MailTransport {
  sendMail(mail: Record<string, unknown>): Promise<{ messageId?: string }>;
}

const TRANSIENT = new Set(['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ESOCKET', 'EAI_AGAIN']);

function isTransient(err: unknown): boolean {
  const e = err as { code?: string; responseCode?: number };
  return (e.code !== undefined && TRANSIENT.has(e.code)) || (e.responseCode !== undefined && e.responseCode >= 400 && e.responseCode < 500);
}

/** D-AUTH-EMAIL D1: any SMTP provider (ZeptoMail, SES SMTP, ...). One retry on a transient failure. */
export class SmtpEmailSender implements EmailSender {
  private readonly transport: MailTransport;

  constructor(private readonly config: SmtpConfig, transport?: MailTransport) {
    this.transport =
      transport ??
      nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.user ? { user: config.user, pass: config.password } : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 10_000,
      });
  }

  async send(msg: EmailMessage): Promise<{ id: string }> {
    const mail = {
      from: this.config.from,
      replyTo: this.config.replyTo,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      headers: { 'X-OneBridge-Tag': msg.tag },
    };
    try {
      const res = await this.transport.sendMail(mail);
      return { id: res.messageId ?? '' };
    } catch (err) {
      if (!isTransient(err)) throw new Error(`Email ${msg.tag} to ${maskEmail(msg.to)} failed`);
      try {
        const res = await this.transport.sendMail(mail);
        return { id: res.messageId ?? '' };
      } catch {
        throw new Error(`Email ${msg.tag} to ${maskEmail(msg.to)} failed after a retry`);
      }
    }
  }
}
