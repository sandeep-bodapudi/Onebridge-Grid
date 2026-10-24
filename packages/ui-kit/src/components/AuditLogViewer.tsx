import React, { useEffect, useState } from 'react';
import { AlertTriangle, Download, FileClock, Filter, RotateCcw, WifiOff } from 'lucide-react';
import { cn } from './ActionButton';
import { Button } from './Button';
import { Select } from './Select';
import { Input } from './Input';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';
import { SlideOverPanel } from './SlideOverPanel';
import { AUDIT_ACTION_OPTIONS, describeAuditAction, auditSubjectName, formatRelativeTime } from './audit-format';

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
  title: 'Audit log',
  subtitle: 'Every change admins make to the company, its people and its cards.',
  exportCsv: 'Export to CSV',
  exporting: 'Exporting...',
  filterActor: 'Person',
  filterAction: 'Action',
  filterEntity: 'Item',
  filterStartDate: 'From',
  filterEndDate: 'To',
  applyFilters: 'Apply filters',
  clearFilters: 'Clear',
  emptyTitle: 'No audit records yet',
  emptyDesc: 'Changes made by admins, such as adding a branch or creating a seat, appear here.',
  noResultsTitle: 'No matching changes',
  noResultsDesc: 'Nothing matches these filters. Clear them to see every change.',
  offlineBanner: 'You are currently offline. Showing the last loaded changes.',
  errorTitle: 'Could not load the audit log',
  retry: 'Retry',
  colTimestamp: 'When',
  colActor: 'Who',
  colAction: 'What happened',
  colEntity: 'Item',
  colIp: 'IP address',
  colDetails: 'Details',
  viewChanges: 'Details',
  drawerTitle: 'Change details',
  beforeTitle: 'Before',
  afterTitle: 'After',
  noChangesRecorded: 'No values were recorded for this change.',
  close: 'Close',
  redactedBadge: 'Confidential data redacted',
  showingResults: 'Showing {count} of {total} changes',
  pagePrev: 'Previous',
  pageNext: 'Next',
};

export const defaultAuditLogLabelsHi: AuditLogViewerLabels = {
  title: 'ऑडिट ट्रेल',
  subtitle: 'प्रशासनिक कार्रवाइयों, इकाई परिवर्तनों और सुरक्षा घटनाओं का अपरिवर्तनीय रिकॉर्ड।',
  exportCsv: 'CSV में निर्यात करें',
  exporting: 'निर्यात हो रहा है...',
  filterActor: 'व्यक्ति',
  filterAction: 'कार्रवाई',
  filterEntity: 'इकाई',
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
  viewChanges: 'विवरण',
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
  /** Person ID → display name; IDs without a name show as "A team member". */
  actorNames?: Record<string, string>;
  /** People offered in the "Person" filter. Defaults to everyone named in actorNames. */
  actorOptions?: Array<{ value: string; label: string }>;
  onFilterChange?: (filters: AuditLogFilters) => void;
  onExportCsv?: () => void;
  onPageChange?: (offset: number) => void;
  onRetry?: () => void;
  labels?: AuditLogViewerLabels;
  className?: string;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function humaniseKey(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
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
  actorNames = {},
  actorOptions,
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
  }, [initialFilters.actor, initialFilters.action, initialFilters.entity, initialFilters.startDate, initialFilters.endDate]);

  const nameOf = (entry: AuditLogItem) => {
    const id = entry.actorPersonId || entry.actor;
    if (actorNames[id]) return actorNames[id];
    if (id === 'system') return 'OneBridge';
    return 'A team member';
  };

  const people = actorOptions ?? Object.entries(actorNames).map(([value, label]) => ({ value, label }));
  const hasActiveFilters = Boolean(
    initialFilters.actor || initialFilters.action || initialFilters.entity || initialFilters.startDate || initialFilters.endDate
  );

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange?.(formFilters);
  };

  const handleClear = () => {
    setFormFilters({});
    onFilterChange?.({});
  };

  const changedKeys = (entry: AuditLogItem) => {
    const before = entry.before || {};
    const after = entry.after || {};
    return Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).filter(
      (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])
    );
  };

  return (
    <div className={cn('space-y-6 text-charcoal dark:text-warm-paper', className)} data-testid="audit-log-viewer">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">{labels.title}</h2>
          <p className="text-sm text-charcoal/70 dark:text-warm-paper/70">{labels.subtitle}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={onExportCsv}
          disabled={isLoading || isExporting || entries.length === 0}
          data-testid="export-csv-btn"
          className="gap-2 self-start sm:self-auto"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          {isExporting ? labels.exporting : labels.exportCsv}
        </Button>
      </div>

      {isOffline ? (
        <div role="status" className="flex items-center gap-3 px-4 py-3 rounded-panel border border-warning/40 bg-warning/10 text-sm">
          <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
          {labels.offlineBanner}
        </div>
      ) : null}

      <form
        onSubmit={handleFilterSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_160px_160px_auto] gap-3 items-end"
        data-testid="audit-filter-form"
      >
        <div className="space-y-1 min-w-0">
          <label htmlFor="audit-filter-actor" className="block text-xs font-semibold text-charcoal/70 dark:text-warm-paper/70">
            {labels.filterActor}
          </label>
          <Select
            id="audit-filter-actor"
            value={formFilters.actor || ''}
            onChange={(e) => setFormFilters({ ...formFilters, actor: e.target.value || undefined })}
            options={[{ value: '', label: 'Everyone' }, ...people]}
          />
        </div>
        <div className="space-y-1 min-w-0">
          <label htmlFor="audit-filter-action" className="block text-xs font-semibold text-charcoal/70 dark:text-warm-paper/70">
            {labels.filterAction}
          </label>
          <Select
            id="audit-filter-action"
            value={formFilters.action || ''}
            onChange={(e) => setFormFilters({ ...formFilters, action: e.target.value || undefined })}
            options={[{ value: '', label: 'All actions' }, ...AUDIT_ACTION_OPTIONS]}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="audit-filter-start" className="block text-xs font-semibold text-charcoal/70 dark:text-warm-paper/70">
            {labels.filterStartDate}
          </label>
          <Input
            id="audit-filter-start"
            type="date"
            value={formFilters.startDate || ''}
            onChange={(e) => setFormFilters({ ...formFilters, startDate: e.target.value || undefined })}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="audit-filter-end" className="block text-xs font-semibold text-charcoal/70 dark:text-warm-paper/70">
            {labels.filterEndDate}
          </label>
          <Input
            id="audit-filter-end"
            type="date"
            value={formFilters.endDate || ''}
            onChange={(e) => setFormFilters({ ...formFilters, endDate: e.target.value || undefined })}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" data-testid="apply-filters-btn" className="gap-2">
            <Filter className="w-4 h-4" aria-hidden="true" />
            {labels.applyFilters}
          </Button>
          {hasActiveFilters || formFilters.actor || formFilters.action || formFilters.startDate || formFilters.endDate ? (
            <Button type="button" variant="ghost" onClick={handleClear}>
              {labels.clearFilters}
            </Button>
          ) : null}
        </div>
      </form>

      {error ? (
        <div
          role="alert"
          data-testid="audit-error-state"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-4 rounded-panel border border-error/40 bg-error/10"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <div className="text-sm font-bold">{labels.errorTitle}</div>
              <div className="text-sm text-charcoal/80 dark:text-warm-paper/80">{error}</div>
            </div>
          </div>
          {onRetry ? (
            <Button type="button" variant="secondary" onClick={onRetry} className="gap-2">
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              {labels.retry}
            </Button>
          ) : null}
        </div>
      ) : isLoading ? (
        <div className="space-y-2" aria-busy="true" data-testid="audit-loading">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={52} />
          ))}
        </div>
      ) : entries.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            data-testid="audit-no-results"
            icon={<Filter className="w-6 h-6" aria-hidden="true" />}
            title={labels.noResultsTitle}
            description={labels.noResultsDesc}
            actionLabel={labels.clearFilters}
            onAction={handleClear}
          />
        ) : (
          <EmptyState
            data-testid="audit-empty-state"
            icon={<FileClock className="w-6 h-6" aria-hidden="true" />}
            title={labels.emptyTitle}
            description={labels.emptyDesc}
          />
        )
      ) : (
        <div className="rounded-panel border border-sand-border dark:border-sand-border/30 overflow-hidden">
          <ul className="divide-y divide-sand-border dark:divide-sand-border/30" aria-label={labels.title}>
            {entries.map((entry) => {
              const subject = auditSubjectName(entry);
              return (
                <li
                  key={entry.id}
                  className="grid grid-cols-[1fr_auto] sm:grid-cols-[140px_1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 bg-warm-paper dark:bg-charcoal"
                >
                  <time
                    dateTime={entry.occurredAt}
                    title={new Date(entry.occurredAt).toLocaleString('en-IN')}
                    className="order-2 sm:order-none col-span-2 sm:col-span-1 text-xs text-charcoal/60 dark:text-warm-paper/60"
                  >
                    {formatRelativeTime(entry.occurredAt)}
                  </time>
                  <p className="text-sm min-w-0">
                    <span className="font-bold">{nameOf(entry)}</span> {describeAuditAction(entry.action)}
                    {subject ? <span className="font-bold"> {subject}</span> : null}
                    <span className="sr-only"> ({entry.action})</span>
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSelectedEntry(entry)}
                    data-testid={`view-diff-${entry.id}`}
                    aria-label={`${labels.viewChanges}: ${describeAuditAction(entry.action)}`}
                    className="text-sm"
                  >
                    {labels.viewChanges}
                  </Button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-sand-border dark:border-sand-border/30 bg-sand/30 dark:bg-charcoal-deep/40 text-sm">
            <span className="text-charcoal/70 dark:text-warm-paper/70">
              {labels.showingResults.replace('{count}', String(entries.length)).replace('{total}', String(total))}
            </span>
            {onPageChange && total > limit ? (
              <div className="flex gap-2">
                <Button type="button" variant="secondary" disabled={offset === 0} onClick={() => onPageChange(Math.max(0, offset - limit))}>
                  {labels.pagePrev}
                </Button>
                <Button type="button" variant="secondary" disabled={offset + limit >= total} onClick={() => onPageChange(offset + limit)}>
                  {labels.pageNext}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <SlideOverPanel isOpen={Boolean(selectedEntry)} onClose={() => setSelectedEntry(null)} title={labels.drawerTitle}>
        {selectedEntry ? (
          <div data-testid="audit-diff-modal" className="space-y-5">
            <p className="text-sm">
              <span className="font-bold">{nameOf(selectedEntry)}</span> {describeAuditAction(selectedEntry.action)}
              {auditSubjectName(selectedEntry) ? <span className="font-bold"> {auditSubjectName(selectedEntry)}</span> : null}
            </p>
            <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-charcoal/60 dark:text-warm-paper/60">{labels.colTimestamp}</dt>
              <dd>{new Date(selectedEntry.occurredAt).toLocaleString('en-IN')}</dd>
              <dt className="text-charcoal/60 dark:text-warm-paper/60">Event</dt>
              <dd className="font-mono text-xs break-all">{selectedEntry.action}</dd>
              <dt className="text-charcoal/60 dark:text-warm-paper/60">{labels.colEntity}</dt>
              <dd className="font-mono text-xs break-all">
                {selectedEntry.entityType} {selectedEntry.entityId}
              </dd>
              {selectedEntry.ip ? (
                <>
                  <dt className="text-charcoal/60 dark:text-warm-paper/60">{labels.colIp}</dt>
                  <dd className="font-mono text-xs">{selectedEntry.ip}</dd>
                </>
              ) : null}
            </dl>

            {changedKeys(selectedEntry).length === 0 ? (
              <p className="text-sm text-charcoal/70 dark:text-warm-paper/70">{labels.noChangesRecorded}</p>
            ) : (
              <div className="rounded-panel border border-sand-border dark:border-sand-border/30 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-sand/40 dark:bg-charcoal-deep/50 text-left">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">Field</th>
                      <th scope="col" className="px-3 py-2 font-semibold">{labels.beforeTitle}</th>
                      <th scope="col" className="px-3 py-2 font-semibold">{labels.afterTitle}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-border dark:divide-sand-border/30">
                    {changedKeys(selectedEntry).map((key) => (
                      <tr key={key}>
                        <th scope="row" className="px-3 py-2 text-left font-semibold align-top">{humaniseKey(key)}</th>
                        <td className="px-3 py-2 align-top break-all text-charcoal/70 dark:text-warm-paper/70">
                          {formatValue(selectedEntry.before?.[key])}
                        </td>
                        <td className="px-3 py-2 align-top break-all">{formatValue(selectedEntry.after?.[key])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-charcoal/60 dark:text-warm-paper/60">{labels.redactedBadge}: phone numbers and lead details are never stored in the audit log.</p>
            <Button type="button" variant="secondary" onClick={() => setSelectedEntry(null)}>
              {labels.close}
            </Button>
          </div>
        ) : null}
      </SlideOverPanel>
    </div>
  );
}
