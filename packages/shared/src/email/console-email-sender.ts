import crypto from 'node:crypto';
import { EmailMessage, EmailSender, maskEmail } from './email-sender.js';

/**
 * Development and test adapter: nothing leaves the machine. It logs the template
 * and the masked recipient; only in development does it print the body, so a
 * developer can read the sign-in code. `createEmailSender` refuses it in production.
 */
export class ConsoleEmailSender implements EmailSender {
  /** The last messages, newest last, so tests can read a code. Bounded. */
  readonly sent: EmailMessage[] = [];

  constructor(private readonly nodeEnv: string = 'development') {}

  async send(msg: EmailMessage): Promise<{ id: string }> {
    const id = `console_${crypto.randomUUID()}`;
    this.sent.push(msg);
    if (this.sent.length > 100) this.sent.shift();
    if (this.nodeEnv !== 'test') {
      console.log(JSON.stringify({ level: 'info', message: 'email.sent', tag: msg.tag, to: maskEmail(msg.to), id }));
    }
    if (this.nodeEnv === 'development') {
      console.log(`\n--- email (development only) to ${msg.to}: ${msg.subject}\n${msg.text}\n---\n`);
    }
    return { id };
  }

  /** Test helper: the newest message to this address. */
  lastTo(to: string): EmailMessage | undefined {
    return [...this.sent].reverse().find((m) => m.to === to);
  }
}
