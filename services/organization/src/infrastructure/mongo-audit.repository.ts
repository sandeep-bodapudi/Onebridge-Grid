import {
  TenantScopedRepository,
  MongoConnectionHandle,
  TenantContext,
  redactSensitiveFields,
} from '@onebridge/shared';
import { AuditLogProps, AuditQueryFilter } from '../domain/audit-log.js';

export class MongoAuditRepository extends TenantScopedRepository<AuditLogProps> {
  constructor(dbOrHandle: MongoConnectionHandle | unknown) {
    super(dbOrHandle as MongoConnectionHandle, 'audit_logs');
  }

  // AC-1, AC-5: Append entry, auto-redacting sensitive credentials and filling defaults
  async record(
    entry: Partial<AuditLogProps> & {
      id: string;
      tenantId: string;
      action: string;
      entityType: string;
      entityId: string;
      occurredAt: string;
    }
  ): Promise<AuditLogProps> {
    const actor = entry.actor || entry.actorPersonId || 'system';
    const actorPersonId = entry.actorPersonId || entry.actor || 'system';
    const ip = entry.ip || '127.0.0.1';

    const safeBefore = entry.before
      ? (redactSensitiveFields(entry.before) as Record<string, unknown>)
      : undefined;
    const safeAfter = entry.after
      ? (redactSensitiveFields(entry.after) as Record<string, unknown>)
      : undefined;

    const normalizedEntry: AuditLogProps = {
      ...entry,
      actor,
      actorPersonId,
      ip,
      before: safeBefore,
      after: safeAfter,
    };

    await this.insertOne(normalizedEntry as Parameters<typeof this.insertOne>[0]);
    return normalizedEntry;
  }

  // AC-2: Entries are append-only. No update or delete path exists in code
  override async updateOne(): Promise<never> {
    throw new Error('Audit logs are append-only. Updates are prohibited.');
  }

  override async updateMany(): Promise<never> {
    throw new Error('Audit logs are append-only. Updates are prohibited.');
  }

  override async findOneAndUpdate(): Promise<never> {
    throw new Error('Audit logs are append-only. Updates are prohibited.');
  }

  override async replaceOne(): Promise<never> {
    throw new Error('Audit logs are append-only. Replacements are prohibited.');
  }

  override async deleteOne(): Promise<never> {
    throw new Error('Audit logs are append-only. Deletes are prohibited.');
  }

  override async deleteMany(): Promise<never> {
    throw new Error('Audit logs are append-only. Generic deletes are prohibited.');
  }

  // AC-4: Retention by plan: purge records older than cutoff date for a specific tenant
  async purgeRetentionCutoff(tenantId: string, cutoffDate: string): Promise<number> {
    return TenantContext.run(tenantId, async () => {
      const result = await super.deleteMany({
        occurredAt: { $lt: cutoffDate },
      } as unknown as Parameters<TenantScopedRepository<AuditLogProps>['deleteMany']>[0]);
      return result.deletedCount;
    });
  }

  // Backward compatibility with earlier listLogs
  async listLogs(entityType?: string, limit = 50): Promise<AuditLogProps[]> {
    const filter: Record<string, unknown> = {};
    if (entityType) {
      filter.entityType = entityType;
    }
    const cursor = await this.find(filter as Parameters<typeof this.find>[0], {
      sort: { occurredAt: -1 },
      limit,
    });
    return cursor;
  }

  // AC-3: Filter by actor, action, entity, and date
  buildMongoFilter(filter: AuditQueryFilter = {}): Record<string, unknown> {
    const mongoFilter: Record<string, unknown> = {};
    const andConditions: Record<string, unknown>[] = [];

    if (filter.actor) {
      andConditions.push({
        $or: [
          { actor: filter.actor },
          { actorPersonId: filter.actor },
        ],
      });
    }

    if (filter.action) {
      mongoFilter.action = filter.action;
    }

    if (filter.entity) {
      andConditions.push({
        $or: [
          { entityType: filter.entity },
          { entityId: filter.entity },
        ],
      });
    } else {
      if (filter.entityType) {
        mongoFilter.entityType = filter.entityType;
      }
      if (filter.entityId) {
        mongoFilter.entityId = filter.entityId;
      }
    }

    if (filter.startDate || filter.endDate) {
      const dateFilter: Record<string, string> = {};
      if (filter.startDate) {
        dateFilter.$gte = filter.startDate;
      }
      if (filter.endDate) {
        dateFilter.$lte = filter.endDate;
      }
      mongoFilter.occurredAt = dateFilter;
    }

    if (andConditions.length > 0) {
      mongoFilter.$and = andConditions;
    }

    return mongoFilter;
  }

  async findLogs(filter: AuditQueryFilter = {}): Promise<AuditLogProps[]> {
    const mongoFilter = this.buildMongoFilter(filter);
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const skip = Math.max(filter.offset ?? 0, 0);

    return this.find(mongoFilter as Parameters<typeof this.find>[0], {
      sort: { occurredAt: -1 },
      limit,
      skip,
    });
  }

  async countLogs(filter: AuditQueryFilter = {}): Promise<number> {
    const mongoFilter = this.buildMongoFilter(filter);
    return this.countDocuments(mongoFilter as Parameters<typeof this.countDocuments>[0]);
  }

  async createIndexes(): Promise<void> {
    await this.collection.createIndex({ tenantId: 1, occurredAt: -1 });
    await this.collection.createIndex({ tenantId: 1, action: 1 });
    await this.collection.createIndex({ tenantId: 1, entityType: 1 });
    await this.collection.createIndex({ tenantId: 1, actorPersonId: 1 });
    await this.collection.createIndex({ tenantId: 1, actor: 1 });
  }
}
