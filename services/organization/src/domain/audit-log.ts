export interface AuditLogProps {
  id: string; // ULID
  tenantId: string;
  actor?: string;
  actorPersonId?: string;
  action: string;
  entityType: string;
  entityId: string;
  ip?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  occurredAt: string;
  [key: string]: unknown;
}

export interface AuditQueryFilter {
  actor?: string;
  action?: string;
  entity?: string;
  entityType?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}
