import { ulid } from 'ulid';
import {
  TenantContext,
  EventBus,
  redactSensitiveFields,
} from '@onebridge/shared';
import { AuditLogProps, AuditQueryFilter } from '../domain/audit-log.js';
import { MongoAuditRepository } from '../infrastructure/mongo-audit.repository.js';
import { MongoOrganizationRepository } from '../infrastructure/mongo-organization.repository.js';
import { EventBusLike } from '../organization.module.js';

export const PLAN_RETENTION_DAYS: Record<string, number> = {
  starter: 90,
  business: 365,
  enterprise: 730,
};

export function getPlanRetentionDays(plan?: string): number {
  const p = (plan || 'starter').toLowerCase();
  return PLAN_RETENTION_DAYS[p] ?? 90;
}

export function computeCutoffDate(plan?: string, now: Date = new Date()): string {
  const days = getPlanRetentionDays(plan);
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return cutoff.toISOString();
}

export function escapeCsvField(field: unknown): string {
  if (field === null || field === undefined) return '';
  const str = typeof field === 'object' ? JSON.stringify(field) : String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatAuditLogsToCsv(entries: AuditLogProps[]): string {
  const headers = [
    'ID',
    'Timestamp',
    'Actor',
    'Action',
    'Entity Type',
    'Entity ID',
    'IP Address',
    'Before',
    'After',
  ];

  const rows = entries.map((entry) => [
    entry.id,
    entry.occurredAt,
    entry.actor || entry.actorPersonId || '',
    entry.action,
    entry.entityType,
    entry.entityId,
    entry.ip || '',
    entry.before ? JSON.stringify(entry.before) : '',
    entry.after ? JSON.stringify(entry.after) : '',
  ]);

  const csvLines = [
    headers.join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ];

  return csvLines.join('\r\n');
}

export interface RecordAuditParams {
  actor?: string;
  actorPersonId?: string;
  action: string;
  entityType: string;
  entityId: string;
  ip?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  occurredAt?: string;
}

export class AuditLogService {
  constructor(
    private readonly auditRepo: MongoAuditRepository,
    private readonly orgRepo: MongoOrganizationRepository,
    private readonly eventBus: EventBusLike | EventBus
  ) {}

  // AC-1, AC-5: Record audit entry with actor, action, entity, before, after, timestamp, IP
  // Auto-redacting passwords, tokens, secrets, hashes, and OTPs
  async recordAudit(
    tenantId: string,
    params: RecordAuditParams,
    correlationId?: string
  ): Promise<AuditLogProps> {
    const now = params.occurredAt || new Date().toISOString();
    const actor = params.actor || params.actorPersonId || 'system';
    const actorPersonId = params.actorPersonId || params.actor || 'system';
    const ip = params.ip || '127.0.0.1';

    const safeBefore = params.before
      ? (redactSensitiveFields(params.before) as Record<string, unknown>)
      : undefined;
    const safeAfter = params.after
      ? (redactSensitiveFields(params.after) as Record<string, unknown>)
      : undefined;

    const entry: AuditLogProps = {
      id: ulid(),
      tenantId,
      actor,
      actorPersonId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      ip,
      before: safeBefore,
      after: safeAfter,
      occurredAt: now,
    };

    await TenantContext.run(tenantId, () => this.auditRepo.record(entry));

    // Emit audit.recorded event
    await this.eventBus.publish({
      eventId: ulid(),
      type: 'audit.recorded',
      version: '1.0.0',
      tenantId,
      occurredAt: now,
      correlationId: correlationId || ulid(),
      payload: {
        id: entry.id,
        actor: entry.actor,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        ip: entry.ip,
        occurredAt: entry.occurredAt,
      },
    });

    return entry;
  }

  // AC-3, AC-4: Filter by actor, action, entity, date. Enforce retention cutoff by plan
  async listAuditLogs(
    tenantId: string,
    query: AuditQueryFilter = {}
  ): Promise<{
    entries: AuditLogProps[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const org = await TenantContext.run(tenantId, () => this.orgRepo.findById(tenantId));
    const retentionCutoff = computeCutoffDate(org?.plan);

    // Enforce retention window: cannot query older than plan retention cutoff
    const effectiveStartDate =
      query.startDate && query.startDate > retentionCutoff
        ? query.startDate
        : retentionCutoff;

    const effectiveFilter: AuditQueryFilter = {
      ...query,
      startDate: effectiveStartDate,
    };

    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);

    return TenantContext.run(tenantId, async () => {
      const [entries, total] = await Promise.all([
        this.auditRepo.findLogs(effectiveFilter),
        this.auditRepo.countLogs(effectiveFilter),
      ]);

      return {
        entries,
        total,
        limit,
        offset,
      };
    });
  }

  // AC-3: Export to CSV respecting filters and plan retention
  async exportAuditLogsCsv(
    tenantId: string,
    query: AuditQueryFilter = {}
  ): Promise<string> {
    const org = await TenantContext.run(tenantId, () => this.orgRepo.findById(tenantId));
    const retentionCutoff = computeCutoffDate(org?.plan);

    const effectiveStartDate =
      query.startDate && query.startDate > retentionCutoff
        ? query.startDate
        : retentionCutoff;

    const effectiveFilter: AuditQueryFilter = {
      ...query,
      startDate: effectiveStartDate,
      limit: 5000,
      offset: 0,
    };

    const entries = await TenantContext.run(tenantId, () =>
      this.auditRepo.findLogs(effectiveFilter)
    );

    return formatAuditLogsToCsv(entries);
  }

  // AC-4: Retention by plan maintenance purge
  async purgeByPlanRetention(
    tenantId: string,
    planOverride?: string
  ): Promise<{ deletedCount: number; cutoffDate: string }> {
    let plan = planOverride;
    if (!plan) {
      const org = await TenantContext.run(tenantId, () => this.orgRepo.findById(tenantId));
      plan = org?.plan || 'starter';
    }

    const cutoffDate = computeCutoffDate(plan);
    const deletedCount = await this.auditRepo.purgeRetentionCutoff(tenantId, cutoffDate);

    return { deletedCount, cutoffDate };
  }
}
