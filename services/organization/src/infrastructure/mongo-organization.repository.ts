import {
  TenantScopedRepository,
  MongoConnectionHandle,
  TenantIsolationError,
} from '@onebridge/shared';
import { OrganizationProps } from '../domain/organization.js';

export interface OrganizationDoc extends OrganizationProps {
  [key: string]: unknown;
}

export class MongoOrganizationRepository extends TenantScopedRepository<OrganizationDoc> {
  constructor(dbOrHandle: MongoConnectionHandle | unknown) {
    super(dbOrHandle as MongoConnectionHandle, 'organizations');
  }

  async findById(id: string): Promise<OrganizationProps | null> {
    const doc = await this.findOne({ id } as unknown as Parameters<typeof this.findOne>[0]);
    return doc ? (doc as unknown as OrganizationProps) : null;
  }

  async findBySlug(slug: string): Promise<OrganizationProps | null> {
    const doc = await this.findOne({ slug } as unknown as Parameters<typeof this.findOne>[0]);
    return doc ? (doc as unknown as OrganizationProps) : null;
  }

  /**
   * Platform-level slug check across all tenants to enforce global slug uniqueness.
   * Checks both active slug and historical previousSlugs.
   */
  async findByAnySlug(slug: string): Promise<OrganizationProps | null> {
    const filter = {
      $or: [{ slug }, { previousSlugs: slug }],
    } as unknown as Parameters<typeof this.collection.findOne>[0];

    const doc = await this.collection.findOne(filter);
    return doc ? (doc as unknown as OrganizationProps) : null;
  }

  /** N02: GSTIN uniqueness across all companies (platform-level check, like slugs). */
  async findByGstinGlobal(gstin: string): Promise<OrganizationProps | null> {
    const doc = await this.collection.findOne({ gstin } as unknown as Parameters<typeof this.collection.findOne>[0]);
    return doc ? (doc as unknown as OrganizationProps) : null;
  }

  async save(org: OrganizationProps): Promise<OrganizationProps> {
    const activeTenantId = this.getActiveTenantId();
    if (org.tenantId && org.tenantId !== activeTenantId) {
      throw new TenantIsolationError(
        `TenantIsolationError: Mismatched tenantId "${org.tenantId}" against active tenantId "${activeTenantId}"`
      );
    }

    const docToSave: OrganizationDoc = {
      ...org,
      tenantId: activeTenantId,
    };

    const idFilter: Parameters<typeof this.replaceOne>[0] = { id: org.id } as unknown as Parameters<typeof this.replaceOne>[0];
    const existing = await this.findOne(idFilter);
    if (existing) {
      const existingTenantId = (existing as Record<string, unknown>).tenantId;
      const existingId = (existing as Record<string, unknown>).id;
      if (existingTenantId !== activeTenantId && existingId !== activeTenantId) {
        throw new TenantIsolationError(`TenantIsolationError: Cannot update another tenant's organization record`);
      }
      await this.replaceOne(
        idFilter,
        docToSave as unknown as Parameters<typeof this.replaceOne>[1]
      );
    } else {
      await this.insertOne(
        docToSave as unknown as Parameters<typeof this.insertOne>[0]
      );
    }

    return docToSave;
  }

  async createIndexes(): Promise<void> {
    await this.collection.createIndex({ id: 1 }, { unique: true });
    await this.collection.createIndex({ businessId: 1 }, { unique: true });
    await this.collection.createIndex({ slug: 1 }, { unique: true });
    await this.collection.createIndex({ previousSlugs: 1 });
    await this.collection.createIndex({ gstin: 1 }, { sparse: true });
  }
}
