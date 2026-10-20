import { TenantScopedRepository, MongoConnectionHandle, TenantIsolationError } from '@onebridge/shared';
import { LeadProps } from '../domain/lead.js';

export interface LeadDoc extends LeadProps {
  [key: string]: unknown;
}

export class MongoLeadRepository extends TenantScopedRepository<LeadDoc> {
  constructor(dbOrHandle: MongoConnectionHandle | unknown) {
    super(dbOrHandle as MongoConnectionHandle, 'leads');
  }

  async ensureIndexes(): Promise<void> {
    try {
      await this.collection.createIndex(
        { tenantId: 1, cardId: 1, phoneBlindIndex: 1, createdAt: -1 },
        { name: 'idx_leads_duplicate_lookup' }
      );
      await this.collection.createIndex(
        { tenantId: 1, createdAt: -1 },
        { name: 'idx_leads_tenant_created' }
      );
    } catch {
      // Ignore if indexes already exist
    }
  }

  async findRecentByBlindIndex(
    cardId: string,
    phoneBlindIndex: string,
    sinceDate: Date
  ): Promise<LeadProps | null> {
    const doc = await this.findOne({
      cardId,
      phoneBlindIndex,
      createdAt: { $gte: sinceDate },
    } as unknown as Parameters<typeof this.findOne>[0]);

    return doc ? (doc as unknown as LeadProps) : null;
  }

  async findById(id: string): Promise<LeadProps | null> {
    const doc = await this.findOne({ id } as unknown as Parameters<typeof this.findOne>[0]);
    return doc ? (doc as unknown as LeadProps) : null;
  }

  async listByTenant(): Promise<LeadProps[]> {
    const docs = await this.find({} as unknown as Parameters<typeof this.find>[0]);
    return docs as unknown as LeadProps[];
  }

  async listByCard(cardId: string): Promise<LeadProps[]> {
    const docs = await this.find({ cardId } as unknown as Parameters<typeof this.find>[0]);
    return docs as unknown as LeadProps[];
  }

  async save(lead: LeadProps): Promise<LeadProps> {
    const activeTenantId = this.getActiveTenantId();
    if (lead.tenantId && lead.tenantId !== activeTenantId) {
      throw new TenantIsolationError(
        `TenantIsolationError: Mismatched tenantId "${lead.tenantId}" against active tenantId "${activeTenantId}"`
      );
    }

    const docToSave: LeadDoc = { ...lead, tenantId: activeTenantId };
    const idFilter = { id: lead.id } as unknown as Parameters<typeof this.findOne>[0];
    const existing = await this.findOne(idFilter);

    if (existing) {
      await this.replaceOne(
        idFilter as unknown as Parameters<typeof this.replaceOne>[0],
        docToSave as unknown as Parameters<typeof this.replaceOne>[1]
      );
    } else {
      await this.insertOne(docToSave as unknown as Parameters<typeof this.insertOne>[0]);
    }

    return docToSave as unknown as LeadProps;
  }
}
