export interface LeadNotificationPayload {
  tenantId: string;
  ownerSeatId: string;
  cardId: string;
  leadId: string;
  source: string;
  sourceTag?: string;
  timestamp: Date;
}

export interface LeadNotifier {
  notifyOwner(payload: LeadNotificationPayload): Promise<void>;
}

export class FakeLeadNotifier implements LeadNotifier {
  public deliveredNotifications: Array<LeadNotificationPayload & { deliveredAt: Date; latencyMs: number }> = [];

  async notifyOwner(payload: LeadNotificationPayload): Promise<void> {
    const start = Date.now();
    // Simulate instantaneous delivery on fake provider
    const deliveredAt = new Date();
    const latencyMs = Date.now() - start;

    this.deliveredNotifications.push({
      ...payload,
      deliveredAt,
      latencyMs,
    });
  }

  getNotificationForLead(leadId: string) {
    return this.deliveredNotifications.find((n) => n.leadId === leadId);
  }

  clear() {
    this.deliveredNotifications = [];
  }
}
