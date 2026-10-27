import { EmailSender, renderEmail } from '@onebridge/shared';
import { InviteChannel } from '../domain/invite.js';

export interface InviteMessage {
  channel: InviteChannel;
  /** Full phone (E.164) or email. Only the notifier sees it; it is never logged. */
  to: string;
  companyName: string;
  seatTitle: string;
  inviteUrl: string;
  expiresAt: string;
}

/**
 * Sends seat invites by SMS, WhatsApp or email (F14 AC-1, through the Notifier).
 * The real channels arrive with F22 (Step 7); until then the fake records
 * what would be sent and, outside production, the link is handed back to the
 * admin so the invite can be opened (D-INVITE-DEV-LINK).
 */
export interface InviteNotifier {
  readonly deliversForReal: boolean;
  send(message: InviteMessage): Promise<void>;
}

export class FakeInviteNotifier implements InviteNotifier {
  readonly deliversForReal = false;
  public sent: InviteMessage[] = [];

  async send(message: InviteMessage): Promise<void> {
    this.sent.push(message);
    // No personal data in logs: channel and company only.
    console.log(`[FakeInviteNotifier] invite via ${message.channel} for ${message.companyName}`);
  }
}

/**
 * D-AUTH-EMAIL D11: invites go by email in production (phone sign-in is off there), through
 * the shared EmailSender. SMS and WhatsApp wait for F22, so they are refused, not faked.
 */
export class EmailInviteNotifier implements InviteNotifier {
  readonly deliversForReal = true;

  constructor(private readonly email: EmailSender, private readonly now: () => Date = () => new Date()) {}

  async send(message: InviteMessage): Promise<void> {
    if (message.channel !== 'email') throw new Error(`Invites by ${message.channel} are not available yet`);
    const days = Math.max(1, Math.round((new Date(message.expiresAt).getTime() - this.now().getTime()) / 86_400_000));
    await this.email.send(
      renderEmail('seat_invite', message.to, { companyName: message.companyName, seatTitle: message.seatTitle, url: message.inviteUrl, days })
    );
  }
}
