'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  AuditLogViewer,
  type AuditLogItem,
  type AuditLogFilters,
  type AuditLogViewerLabels,
  defaultAuditLogLabelsEn,
} from '@onebridge/ui-kit';
import { apiClient } from '../../api-client';

export interface AuditLogFeatureProps {
  tenantId: string;
  userRole?: 'owner' | 'admin' | 'employee';
  labels?: Partial<AuditLogViewerLabels>;
  /** The signed-in person, so their own changes show their name. */
  selfPersonId?: string;
  selfName?: string;
  className?: string;
}

export const AuditLogFeature: React.FC<AuditLogFeatureProps> = ({
  tenantId,
  userRole = 'admin',
  labels,
  selfPersonId,
  selfName,
  className,
}) => {
  const [actorNames, setActorNames] = useState<Record<string, string>>({});
  const [entries, setEntries] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(
    async (currentFilters: AuditLogFilters, currentOffset: number) => {
      if (!tenantId) return;
      if (userRole !== 'owner' && userRole !== 'admin') {
        setError('Access denied: Audit log is restricted to Owner and Admin roles.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const response = await apiClient.getAuditLogs(tenantId, {
          ...currentFilters,
          limit,
          offset: currentOffset,
        });

        const rawList =
          response.items ||
          (response as unknown as { entries?: typeof response.items }).entries ||
          [];
        setEntries(
          rawList.map((entry) => ({
            id: entry.id,
            tenantId: entry.tenantId,
            actor: entry.actor || entry.actorPersonId || 'system',
            actorPersonId: entry.actorPersonId,
            action: entry.action,
            entityType: entry.entityType,
            entityId: entry.entityId,
            ip: entry.ip ?? undefined,
            before: (entry.before as Record<string, unknown> | null) ?? null,
            after: (entry.after as Record<string, unknown> | null) ?? null,
            occurredAt: entry.occurredAt,
          }))
        );
        setTotal(response.total ?? 0);
        setIsOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load audit logs');
      } finally {
        setIsLoading(false);
      }
    },
    [tenantId, userRole, limit]
  );

  useEffect(() => {
    fetchLogs(filters, offset);
  }, [fetchLogs, filters, offset]);

  // Person ID → name: people are known by the name on their seat's card.
  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      const [seatPage, cards] = await Promise.all([
        apiClient.listSeats(tenantId, { limit: 100 }).catch(() => ({ items: [] as Array<{ id: string; personId?: string | null }> })),
        apiClient.listCardSummaries(tenantId).catch(() => []),
      ]);
      if (cancelled) return;
      const nameBySeat = new Map(cards.map((c) => [c.seatId || c.id, c.name]));
      const names: Record<string, string> = {};
      for (const seat of seatPage.items || []) {
        const name = nameBySeat.get(seat.id);
        if (seat.personId && name) names[seat.personId] = name;
      }
      if (selfPersonId && selfName) names[selfPersonId] = names[selfPersonId] || selfName;
      setActorNames(names);
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, selfPersonId, selfName]);

  const handleFilterChange = (newFilters: AuditLogFilters) => {
    setFilters(newFilters);
    setOffset(0);
  };

  const handlePageChange = (newOffset: number) => {
    setOffset(newOffset);
  };

  const handleExportCsv = async () => {
    if (!tenantId) return;
    setIsExporting(true);
    try {
      const csvData = await apiClient.exportAuditLogsCsv(tenantId, filters);

      // Create download anchor
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-logs-${tenantId}-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to export audit logs');
    } finally {
      setIsExporting(false);
    }
  };

  const mergedLabels: AuditLogViewerLabels = {
    ...defaultAuditLogLabelsEn,
    ...labels,
  };

  return (
    <div className={className} data-testid="audit-log-feature">
      <AuditLogViewer
        entries={entries}
        total={total}
        limit={limit}
        offset={offset}
        isLoading={isLoading}
        isExporting={isExporting}
        isOffline={isOffline}
        error={error}
        filters={filters}
        actorNames={actorNames}
        onFilterChange={handleFilterChange}
        onExportCsv={handleExportCsv}
        onPageChange={handlePageChange}
        onRetry={() => fetchLogs(filters, offset)}
        labels={mergedLabels}
      />
    </div>
  );
};
