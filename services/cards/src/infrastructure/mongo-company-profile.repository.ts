import { TenantScopedRepository, MongoConnectionHandle } from '@onebridge/shared';
import { CompanyProfileProps } from '../domain/company-profile.js';

export interface CompanyProfileDoc extends CompanyProfileProps {
  id: string; // = tenantId
  [key: string]: unknown;
}

type Base = TenantScopedRepository<CompanyProfileDoc>;

/** One public company page settings document per company (F26). */
export class MongoCompanyProfileRepository extends TenantScopedRepository<CompanyProfileDoc> {
  constructor(dbOrHandle: MongoConnectionHandle | unknown) {
    super(dbOrHandle as MongoConnectionHandle, 'company_profiles');
  }

  async findForTenant(): Promise<CompanyProfileProps | null> {
    const doc = await this.findOne({ id: this.getActiveTenantId() } as unknown as Parameters<Base['findOne']>[0]);
    if (!doc) return null;
    const { _id: _ignored, id: _id2, ...rest } = doc as CompanyProfileDoc & { _id?: unknown };
    return rest as unknown as CompanyProfileProps;
  }

  async save(profile: CompanyProfileProps): Promise<CompanyProfileProps> {
    const tenantId = this.getActiveTenantId();
    const doc: CompanyProfileDoc = { ...profile, tenantId, id: tenantId };
    const filter = { id: tenantId } as unknown as Parameters<Base['findOne']>[0];
    const existing = await this.findOne(filter);
    if (existing) {
      await this.replaceOne(filter as unknown as Parameters<Base['replaceOne']>[0], doc as unknown as Parameters<Base['replaceOne']>[1]);
    } else {
      await this.insertOne(doc as unknown as Parameters<Base['insertOne']>[0]);
    }
    return { ...profile, tenantId };
  }

  async createIndexes(): Promise<void> {
    try {
      await this.collection.createIndex({ id: 1 }, { unique: true });
    } catch {
      // already exists
    }
  }
}
