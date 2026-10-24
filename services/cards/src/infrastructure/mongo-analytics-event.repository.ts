import { TenantScopedRepository, MongoConnectionHandle, TenantIsolationError } from '@onebridge/shared';
import { AnalyticsEventProps } from '../domain/analytics-event.js';

export interface AnalyticsEventDoc extends AnalyticsEventProps {
  [key: string]: unknown;
}

export class MongoAnalyticsEventRepository extends TenantScopedRepository<AnalyticsEventDoc> {
  constructor(dbOrHandle: MongoConnectionHandle | unknown) {
    super(dbOrHandle as MongoConnectionHandle, 'analytics_events');
  }

  async createIndexes(): Promise<void> {
    try {
      await this.collection.createIndex(
        { tenantId: 1, createdAt: -1 },
        { name: 'idx_analytics_tenant_created' }
      );
      await this.collection.createIndex(
        { tenantId: 1, cardId: 1, eventType: 1 },
        { name: 'idx_analytics_tenant_card_event' }
      );
      await this.collection.createIndex(
        { tenantId: 1, eventType: 1, createdAt: -1 },
        { name: 'idx_analytics_tenant_event_created' }
      );
    } catch {
      // Indexes may already exist
    }
  }

  async save(event: AnalyticsEventProps): Promise<AnalyticsEventProps> {
    const activeTenantId = this.getActiveTenantId();
    if (event.tenantId && event.tenantId !== activeTenantId) {
      throw new TenantIsolationError(
        `TenantIsolationError: Mismatched tenantId "${event.tenantId}" against active tenantId "${activeTenantId}"`
      );
    }

    const docToSave: AnalyticsEventDoc = { ...event, tenantId: activeTenantId };
    await this.insertOne(docToSave as unknown as Parameters<typeof this.insertOne>[0]);
    return docToSave as unknown as AnalyticsEventProps;
  }

  async saveBatch(events: AnalyticsEventProps[]): Promise<AnalyticsEventProps[]> {
    if (events.length === 0) return [];
    const activeTenantId = this.getActiveTenantId();
    const docsToSave: AnalyticsEventDoc[] = events.map((event) => {
      if (event.tenantId && event.tenantId !== activeTenantId) {
        throw new TenantIsolationError(
          `TenantIsolationError: Mismatched tenantId "${event.tenantId}" against active tenantId "${activeTenantId}"`
        );
      }
      return { ...event, tenantId: activeTenantId };
    });

    await this.insertMany(docsToSave as unknown as Parameters<typeof this.insertMany>[0]);
    return docsToSave as unknown as AnalyticsEventProps[];
  }

  async listByCard(cardId: string, limit = 100): Promise<AnalyticsEventProps[]> {
    const docs = await this.find(
      { cardId } as unknown as Parameters<typeof this.find>[0],
      { limit, sort: { createdAt: -1 } }
    );
    return docs as unknown as AnalyticsEventProps[];
  }

  async countByCardAndType(cardId: string, eventType: string): Promise<number> {
    return this.countDocuments({ cardId, eventType } as unknown as Parameters<typeof this.countDocuments>[0]);
  }

  async countByTenantAndType(eventType: string): Promise<number> {
    return this.countDocuments({ eventType } as unknown as Parameters<typeof this.countDocuments>[0]);
  }

  async getCardOverviewMetrics(cardId: string): Promise<{ views: number; saves: number }> {
    const [views, saves] = await Promise.all([
      this.countByCardAndType(cardId, 'card_viewed'),
      this.countByCardAndType(cardId, 'contact_saved'),
    ]);
    return { views, saves };
  }

  async getTenantOverviewMetrics(): Promise<{ views: number; saves: number; qrScans: number }> {
    const [views, saves, qrScans] = await Promise.all([
      this.countByTenantAndType('card_viewed'),
      this.countByTenantAndType('contact_saved'),
      this.countByTenantAndType('qr_scanned'),
    ]);
    return { views, saves, qrScans };
  }
}
