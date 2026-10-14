import React, { useState, useEffect } from 'react';
import { cn, ActionButton } from './ActionButton';

export interface AuditLogItem {
  id: string;
  tenantId: string;
  actor: string;
  actorPersonId?: string;
  action: string;
  entityType: string;
  entityId: string;
  ip?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  occurredAt: string;
}

export interface AuditLogFilters {
  actor?: string;
  action?: string;
  entity?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditLogViewerLabels {
  title: string;
  subtitle: string;
  exportCsv: string;
  exporting: string;
  filterActor: string;
  filterAction: string;
  filterEntity: string;
  filterStartDate: string;
  filterEndDate: string;
  applyFilters: string;
  clearFilters: string;
  emptyTitle: string;
  emptyDesc: string;
  noResultsTitle: string;
  noResultsDesc: string;
  offlineBanner: string;
  errorTitle: string;
  retry: string;
  colTimestamp: string;
  colActor: string;
  colAction: string;
  colEntity: string;
  colIp: string;
  colDetails: string;
  viewChanges: string;
  drawerTitle: string;
  beforeTitle: string;
  afterTitle: string;
  noChangesRecorded: string;
  close: string;
  redactedBadge: string;
  showingResults: string;
  pagePrev: string;
  pageNext: string;
}

export const defaultAuditLogLabelsEn: AuditLogViewerLabels = {
  title: 'Audit trail',
  subtitle: 'Immutable record of administrative actions, entity updates, and security events.',
  exportCsv: 'Export to CSV',
  exporting: 'Exporting...',
  filterActor: 'Search by actor ID',
  filterAction: 'Filter by action (e.g. branch.created)',
  filterEntity: 'Filter by entity ID or type',
  filterStartDate: 'Start date',
  filterEndDate: 'End date',
  applyFilters: 'Apply filters',
  clearFilters: 'Clear',
  emptyTitle: 'No audit records yet',
  emptyDesc: 'Administrative actions and updates performed by company admins will appear here.',
  noResultsTitle: 'No matching audit records',
  noResultsDesc: 'No audit events match your selected search and date filters.',
  offlineBanner: 'You are currently offline. Viewing cached audit logs.',
  errorTitle: 'Failed to load audit logs',
  retry: 'Retry',
  colTimestamp: 'Timestamp',
  colActor: 'Actor',
  colAction: 'Action',
  colEntity: 'Entity',
  colIp: 'IP Address',
  colDetails: 'Details',
  viewChanges: 'View diff',
  drawerTitle: 'Audit event details',
  beforeTitle: 'Before change',
  afterTitle: 'After change',
  noChangesRecorded: 'No state payload recorded for this action',
  close: 'Close',
  redactedBadge: 'Confidential data redacted',
  showingResults: 'Showing {count} of {total} events',
  pagePrev: 'Previous',
  pageNext: 'Next',
};

export const defaultAuditLogLabelsHi: AuditLogViewerLabels = {
  title: 'ऑडिट ट्रेल',
  subtitle: 'प्रशासनिक कार्रवाइयों, इकाई परिवर्तनों और सुरक्षा घटनाओं का अपरिवर्तनीय रिकॉर्ड।',
  exportCsv: 'CSV में निर्यात करें',
  exporting: 'निर्यात हो रहा है...',
  filterActor: 'कर्ता आईडी द्वारा खोजें',
  filterAction: 'कार्रवाई द्वारा फ़िल्टर करें',
  filterEntity: 'इकाई आईडी या प्रकार द्वारा फ़िल्टर करें',
  filterStartDate: 'प्रारंभ तिथि',
  filterEndDate: 'समाप्ति तिथि',
  applyFilters: 'फ़िल्टर लागू करें',
  clearFilters: 'साफ़ करें',
  emptyTitle: 'कोई ऑडिट रिकॉर्ड नहीं',
  emptyDesc: 'कंपनी व्यवस्थापकों द्वारा किए गए प्रशासनिक कार्य यहाँ दिखाई देंगे।',
  noResultsTitle: 'कोई मेल खाने वाला ऑडिट रिकॉर्ड नहीं',
  noResultsDesc: 'आपके चयनित फ़िल्टर से कोई ऑडिट घटना मेल नहीं खाती।',
  offlineBanner: 'आप वर्तमान में ऑफ़लाइन हैं। कैश्ड ऑडिट लॉग देख रहे हैं।',
  errorTitle: 'ऑडिट लॉग लोड करने में विफल',
  retry: 'पुनः प्रयास करें',
  colTimestamp: 'समय',
  colActor: 'कर्ता',
  colAction: 'कार्रवाई',
  colEntity: 'इकाई',
  colIp: 'आईपी पता',
  colDetails: 'विवरण',
  viewChanges: 'डिफ़ देखें',
  drawerTitle: 'ऑडिट घटना विवरण',
  beforeTitle: 'परिवर्तन से पहले',
  afterTitle: 'परिवर्तन के बाद',
  noChangesRecorded: 'इस कार्रवाई के लिए कोई स्थिति पेलोड रिकॉर्ड नहीं किया गया',
  close: 'बंद करें',
  redactedBadge: 'गोपनीय डेटा छुपाया गया',
  showingResults: '{total} घटनाओं में से {count} दिखाई जा रही हैं',
  pagePrev: 'पिछला',
  pageNext: 'अगला',
};

export interface AuditLogViewerProps {
  entries?: AuditLogItem[];
  total?: number;
  limit?: number;
  offset?: number;
  isLoading?: boolean;
  isExporting?: boolean;
  isOffline?: boolean;
  error?: string | null;
  filters?: AuditLogFilters;
  onFilterChange?: (filters: AuditLogFilters) => void;
  onExportCsv?: () => void;
  onPageChange?: (offset: number) => void;
  onRetry?: () => void;
  labels?: AuditLogViewerLabels;
  className?: string;
}

export function AuditLogViewer({
  entries = [],
  total = 0,
  limit = 50,
  offset = 0,
  isLoading = false,
  isExporting = false,
  isOffline = false,
  error = null,
  filters: initialFilters = {},
  onFilterChange,
  onExportCsv,
  onPageChange,
  onRetry,
  labels = defaultAuditLogLabelsEn,
  className,
}: AuditLogViewerProps) {
  const [selectedEntry, setSelectedEntry] = useState<AuditLogItem | null>(null);
  const [formFilters, setFormFilters] = useState<AuditLogFilters>(initialFilters);

  useEffect(() => {
    setFormFilters(initialFilters);
  }, [
    initialFilters.actor,
    initialFilters.action,
    initialFilters.entity,
    initialFilters.startDate,
    initialFilters.endDate,
  ]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange?.(formFilters);
  };

  const handleClear = () => {
    const emptyFilters: AuditLogFilters = {};
    setFormFilters(emptyFilters);
    onFilterChange?.(emptyFilters);
  };

  const hasActiveFilters = Boolean(
    formFilters.actor ||
      formFilters.action ||
      formFilters.entity ||
      formFilters.startDate ||
      formFilters.endDate ||
      initialFilters.actor ||
      initialFilters.action ||
      initialFilters.entity ||
      initialFilters.startDate ||
      initialFilters.endDate
  );

  return (
    <div
      className={cn(
        'w-full max-w-6xl mx-auto space-y-24 p-24 bg-warm-paper dark:bg-charcoal text-charcoal dark:text-warm-paper rounded-24 border border-sand-border',
        className
      )}
      data-testid="audit-log-viewer"
    >
      {/* Offline banner */}
      {isOffline && (
        <div
          role="status"
          className="flex items-center gap-12 p-16 rounded-16 bg-sand dark:bg-charcoal-deep border border-bridge-orange/30 text-charcoal dark:text-warm-paper"
        >
          <span className="text-deep-orange text-lg font-bold" aria-hidden="true">
            ⚠
          </span>
          <span className="text-sm font-medium">{labels.offlineBanner}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-16 pb-16 border-b border-sand-border">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{labels.title}</h1>
          <p className="text-sm text-charcoal/70 dark:text-warm-paper/70 mt-4">
            {labels.subtitle}
          </p>
        </div>

        <div>
          <ActionButton
            type="button"
            variant="primary"
            onClick={onExportCsv}
            disabled={isLoading || isExporting || entries.length === 0}
            className="min-h-[44px]"
            data-testid="export-csv-btn"
          >
            {isExporting ? labels.exporting : labels.exportCsv}
          </ActionButton>
        </div>
      </div>

      {/* Filter form */}
      <form
        onSubmit={handleFilterSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-12 p-16 rounded-16 bg-sand/60 dark:bg-charcoal-deep/60 border border-sand-border"
        data-testid="audit-filter-form"
      >
        <div>
          <label htmlFor="filter-actor" className="block text-xs font-bold mb-4">
            {labels.colActor}
          </label>
          <input
            id="filter-actor"
            type="text"
            value={formFilters.actor || ''}
            onChange={(e) => setFormFilters({ ...formFilters, actor: e.target.value })}
            placeholder={labels.filterActor}
            className="w-full min-h-[44px] px-12 py-8 rounded-12 border border-sand-border bg-white dark:bg-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-bridge-orange"
          />
        </div>

        <div>
          <label htmlFor="filter-action" className="block text-xs font-bold mb-4">
            {labels.colAction}
          </label>
          <input
            id="filter-action"
            type="text"
            value={formFilters.action || ''}
            onChange={(e) => setFormFilters({ ...formFilters, action: e.target.value })}
            placeholder={labels.filterAction}
            className="w-full min-h-[44px] px-12 py-8 rounded-12 border border-sand-border bg-white dark:bg-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-bridge-orange"
          />
        </div>

        <div>
          <label htmlFor="filter-entity" className="block text-xs font-bold mb-4">
            {labels.colEntity}
          </label>
          <input
            id="filter-entity"
            type="text"
            value={formFilters.entity || ''}
            onChange={(e) => setFormFilters({ ...formFilters, entity: e.target.value })}
            placeholder={labels.filterEntity}
            className="w-full min-h-[44px] px-12 py-8 rounded-12 border border-sand-border bg-white dark:bg-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-bridge-orange"
          />
        </div>

        <div>
          <label htmlFor="filter-start-date" className="block text-xs font-bold mb-4">
            {labels.filterStartDate}
          </label>
          <input
            id="filter-start-date"
            type="date"
            value={formFilters.startDate?.split('T')[0] || ''}
            onChange={(e) =>
              setFormFilters({
                ...formFilters,
                startDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
              })
            }
            className="w-full min-h-[44px] px-12 py-8 rounded-12 border border-sand-border bg-white dark:bg-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-bridge-orange"
          />
        </div>

        <div>
          <label htmlFor="filter-end-date" className="block text-xs font-bold mb-4">
            {labels.filterEndDate}
          </label>
          <input
            id="filter-end-date"
            type="date"
            value={formFilters.endDate?.split('T')[0] || ''}
            onChange={(e) =>
              setFormFilters({
                ...formFilters,
                endDate: e.target.value
                  ? new Date(`${e.target.value}T23:59:59.999Z`).toISOString()
                  : undefined,
              })
            }
            className="w-full min-h-[44px] px-12 py-8 rounded-12 border border-sand-border bg-white dark:bg-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-bridge-orange"
          />
        </div>

        <div className="lg:col-span-5 flex items-center justify-end gap-12 mt-8">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClear}
              className="min-h-[44px] px-16 py-8 rounded-12 text-sm font-bold text-charcoal/70 dark:text-warm-paper/70 hover:bg-sand dark:hover:bg-charcoal-deep transition-colors"
              data-testid="clear-filters-btn"
            >
              {labels.clearFilters}
            </button>
          )}
          <ActionButton
            type="submit"
            variant="secondary"
            className="min-h-[44px] px-20 py-8 text-sm"
            data-testid="apply-filters-btn"
          >
            {labels.applyFilters}
          </ActionButton>
        </div>
      </form>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="p-16 rounded-16 bg-error/10 border border-error/20 text-error flex items-center justify-between gap-16"
          data-testid="audit-error-state"
        >
          <div>
            <h3 className="font-bold">{labels.errorTitle}</h3>
            <p className="text-sm mt-2">{error}</p>
          </div>
          {onRetry && (
            <ActionButton
              type="button"
              variant="secondary"
              onClick={onRetry}
              className="min-h-[44px] text-xs py-8 px-16"
            >
              {labels.retry}
            </ActionButton>
          )}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-12 animate-pulse" data-testid="audit-loading-skeleton">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-64 rounded-16 bg-sand dark:bg-charcoal-deep border border-sand-border"
            />
          ))}
        </div>
      )}

      {/* Empty states */}
      {!isLoading && !error && entries.length === 0 && (
        <div
          className="p-48 text-center rounded-20 border border-dashed border-sand-border bg-sand/20 dark:bg-charcoal-deep/20"
          data-testid={hasActiveFilters ? 'audit-no-results' : 'audit-empty-state'}
        >
          <div className="text-3xl mb-12">📋</div>
          <h2 className="text-lg font-bold">
            {hasActiveFilters ? labels.noResultsTitle : labels.emptyTitle}
          </h2>
          <p className="text-sm text-charcoal/70 dark:text-warm-paper/70 max-w-md mx-auto mt-4">
            {hasActiveFilters ? labels.noResultsDesc : labels.emptyDesc}
          </p>
          {hasActiveFilters && (
            <div className="mt-16">
              <ActionButton
                type="button"
                variant="secondary"
                onClick={handleClear}
                className="min-h-[44px] text-xs py-8 px-16"
              >
                {labels.clearFilters}
              </ActionButton>
            </div>
          )}
        </div>
      )}

      {/* Log entries table */}
      {!isLoading && !error && entries.length > 0 && (
        <div className="space-y-16">
          <div className="overflow-x-auto rounded-16 border border-sand-border">
            <table className="w-full text-left text-sm" data-testid="audit-log-table">
              <thead className="bg-sand dark:bg-charcoal-deep border-b border-sand-border text-xs uppercase font-bold text-charcoal/70 dark:text-warm-paper/70">
                <tr>
                  <th scope="col" className="p-16">
                    {labels.colTimestamp}
                  </th>
                  <th scope="col" className="p-16">
                    {labels.colActor}
                  </th>
                  <th scope="col" className="p-16">
                    {labels.colAction}
                  </th>
                  <th scope="col" className="p-16">
                    {labels.colEntity}
                  </th>
                  <th scope="col" className="p-16">
                    {labels.colIp}
                  </th>
                  <th scope="col" className="p-16 text-right">
                    {labels.colDetails}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-border">
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-sand/30 dark:hover:bg-charcoal-deep/30 transition-colors"
                  >
                    <td className="p-16 font-mono text-xs whitespace-nowrap">
                      {new Date(entry.occurredAt).toLocaleString()}
                    </td>
                    <td className="p-16 font-mono text-xs">{entry.actor || entry.actorPersonId || 'system'}</td>
                    <td className="p-16 font-semibold">
                      <span className="inline-block px-8 py-2 rounded-8 bg-sand dark:bg-charcoal-deep font-mono text-xs">
                        {entry.action}
                      </span>
                    </td>
                    <td className="p-16">
                      <div className="font-mono text-xs font-bold">{entry.entityId}</div>
                      <div className="text-xs text-charcoal/60 dark:text-warm-paper/60 uppercase">
                        {entry.entityType}
                      </div>
                    </td>
                    <td className="p-16 font-mono text-xs text-charcoal/70 dark:text-warm-paper/70">
                      {entry.ip || '—'}
                    </td>
                    <td className="p-16 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedEntry(entry)}
                        className="min-h-[44px] px-12 py-6 rounded-12 text-xs font-bold bg-sand dark:bg-charcoal-deep hover:bg-sand-border transition-colors inline-flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-bridge-orange"
                        data-testid={`view-diff-${entry.id}`}
                      >
                        {labels.viewChanges}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-12 px-4 py-8 text-xs text-charcoal/70 dark:text-warm-paper/70">
            <div>
              {labels.showingResults
                .replace('{count}', String(entries.length))
                .replace('{total}', String(total || entries.length))}
            </div>

            {total > limit && onPageChange && (
              <div className="flex items-center gap-8">
                <ActionButton
                  type="button"
                  variant="ghost"
                  onClick={() => onPageChange(Math.max(0, offset - limit))}
                  disabled={offset <= 0}
                  className="min-h-[44px] text-xs px-16 py-8"
                >
                  {labels.pagePrev}
                </ActionButton>
                <span className="font-bold">
                  {Math.floor(offset / limit) + 1} / {Math.ceil(total / limit)}
                </span>
                <ActionButton
                  type="button"
                  variant="ghost"
                  onClick={() => onPageChange(offset + limit)}
                  disabled={offset + limit >= total}
                  className="min-h-[44px] text-xs px-16 py-8"
                >
                  {labels.pageNext}
                </ActionButton>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Diff / Detail Modal or Drawer */}
      {selectedEntry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="diff-drawer-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-16 bg-charcoal/60 backdrop-blur-sm"
          data-testid="audit-diff-modal"
        >
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-warm-paper dark:bg-charcoal rounded-24 border border-sand-border shadow-2xl overflow-hidden">
            <div className="p-20 border-b border-sand-border flex items-center justify-between">
              <div>
                <h2 id="diff-drawer-title" className="text-lg font-bold">
                  {labels.drawerTitle}
                </h2>
                <div className="flex items-center gap-8 mt-4 text-xs font-mono text-charcoal/70 dark:text-warm-paper/70">
                  <span className="font-bold">{selectedEntry.action}</span>
                  <span>•</span>
                  <span>{new Date(selectedEntry.occurredAt).toLocaleString()}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                aria-label={labels.close}
                className="min-h-[44px] min-w-[44px] rounded-12 p-8 text-charcoal/70 dark:text-warm-paper/70 hover:bg-sand dark:hover:bg-charcoal-deep transition-colors inline-flex items-center justify-center text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-20 overflow-y-auto space-y-20 flex-1">
              {/* Event metadata summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 p-12 rounded-12 bg-sand/50 dark:bg-charcoal-deep/50 text-xs font-mono">
                <div>
                  <span className="text-charcoal/60 dark:text-warm-paper/60 block">Actor:</span>
                  <span className="font-bold">{selectedEntry.actor || selectedEntry.actorPersonId || 'system'}</span>
                </div>
                <div>
                  <span className="text-charcoal/60 dark:text-warm-paper/60 block">IP:</span>
                  <span className="font-bold">{selectedEntry.ip || '—'}</span>
                </div>
                <div>
                  <span className="text-charcoal/60 dark:text-warm-paper/60 block">Entity:</span>
                  <span className="font-bold">{selectedEntry.entityType}</span>
                </div>
                <div>
                  <span className="text-charcoal/60 dark:text-warm-paper/60 block">Entity ID:</span>
                  <span className="font-bold truncate block">{selectedEntry.entityId}</span>
                </div>
              </div>

              {/* Security Redaction Indicator */}
              <div className="flex items-center gap-8 p-12 rounded-12 bg-sand dark:bg-charcoal-deep border border-bridge-orange/20 text-xs">
                <span className="text-deep-orange font-bold text-sm" aria-hidden="true">
                  🛡
                </span>
                <span>{labels.redactedBadge}</span>
              </div>

              {/* Before and After Diffs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                <div>
                  <h3 className="text-xs font-bold uppercase text-charcoal/70 dark:text-warm-paper/70 mb-6">
                    {labels.beforeTitle}
                  </h3>
                  <div className="p-12 rounded-12 bg-sand/40 dark:bg-charcoal-deep/40 border border-sand-border min-h-[140px] text-xs font-mono overflow-x-auto">
                    {selectedEntry.before ? (
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(selectedEntry.before, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-charcoal/50 italic py-16 text-center">
                        {labels.noChangesRecorded}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase text-charcoal/70 dark:text-warm-paper/70 mb-6">
                    {labels.afterTitle}
                  </h3>
                  <div className="p-12 rounded-12 bg-sand/40 dark:bg-charcoal-deep/40 border border-sand-border min-h-[140px] text-xs font-mono overflow-x-auto">
                    {selectedEntry.after ? (
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(selectedEntry.after, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-charcoal/50 italic py-16 text-center">
                        {labels.noChangesRecorded}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-16 border-t border-sand-border flex justify-end">
              <ActionButton
                type="button"
                variant="secondary"
                onClick={() => setSelectedEntry(null)}
                className="min-h-[44px] text-xs px-20 py-8"
              >
                {labels.close}
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
