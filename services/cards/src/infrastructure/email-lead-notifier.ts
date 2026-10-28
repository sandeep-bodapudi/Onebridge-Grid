import { EmailSender, TenantContext, renderEmail } from '@onebridge/shared';
import { LeadNotificationPayload, LeadNotifier } from '../domain/notifier.js';
import { MongoSeatReadModelRepository } from './mongo-read-model.repositories.js';

/** How the notifier finds the card owner's email (identity's /internal endpoint). */
export interface OwnerEmailLookup {
  emailOf(personId: string): Promise<string | undefined>;
}

export class HttpOwnerEmailLookup implements OwnerEmailLookup {
  constructor(private readonly identityBaseUrl: string, private readonly serviceKey: string) {}

  async emailOf(personId: string): Promise<string | undefined> {
    const url = `${this.identityBaseUrl.replace(/\/+$/, '')}/internal/persons/${encodeURIComponent(personId)}/contacts`;
    const res = await fetch(url, { headers: { 'x-service-key': this.serviceKey }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { email?: string };
    return body.email || undefined;
  }
}

/**
 * D-VPS-DEPLOY B1: "New lead on your card" by email. The email carries no lead details (the
 * visitor's name and contact stay encrypted in the dashboard), only a link to the dashboard.
 * It runs after the lead is saved and never fails or delays the share-back.
 */
export class EmailLeadNotifier implements LeadNotifier {
  constructor(
    private readonly seats: Pick<MongoSeatReadModelRepository, 'findBySeatId'>,
    private readonly owners: OwnerEmailLookup,
    private readonly email: EmailSender,
    private readonly dashboardUrl: string
  ) {}

  async notifyOwner(payload: LeadNotificationPayload): Promise<void> {
    void this.send(payload).catch((err: unknown) => {
      console.warn(JSON.stringify({ level: 'warn', message: 'Lead email failed', leadId: payload.leadId, reason: err instanceof Error ? err.message : 'unknown' }));
    });
  }

  /** Exposed for tests, which await the delivery. */
  async send(payload: LeadNotificationPayload): Promise<boolean> {
    // Seat read models are company-scoped.
    const seat = await TenantContext.run(payload.tenantId, () => this.seats.findBySeatId(payload.ownerSeatId));
    if (!seat?.personId) return false;
    const to = await this.owners.emailOf(seat.personId);
    if (!to) return false;
    await this.email.send(renderEmail('new_lead', to, { url: this.dashboardUrl }));
    return true;
  }
}
