'use client';

import React, { useEffect, useState } from 'react';
import { Inbox, Phone, Mail, Search } from 'lucide-react';
import { EmptyState, Input, Skeleton, formatRelativeTime } from '@onebridge/ui-kit';
import type { LeadSummary } from '@onebridge/api-contracts';
import { apiClient } from '../../api-client';

export interface LeadsFeatureProps {
  tenantId: string;
  className?: string;
}

/**
 * Read-only list of share-back leads for the hosted prototype (flag
 * demo_leads_panel). Full leads management is outside F13; this only lets an
 * owner see that a visitor's details arrived. Lead data stays in memory and
 * is never written to browser storage (AGENTS.md).
 */
export const LeadsFeature: React.FC<LeadsFeatureProps> = ({ tenantId, className }) => {
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiClient
      .listLeads(tenantId)
      .then((items) => {
        if (!cancelled) setLeads(items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load leads');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const q = query.trim().toLowerCase();
  const visible = leads.filter((l) => !q || [l.name, l.company, l.ownerName, l.sourceTag].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));

  return (
    <div className={className} data-testid="leads-feature">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold">Leads</h2>
          <p className="text-sm text-charcoal/70 dark:text-warm-paper/70 max-w-2xl">
            People who shared their details from a card. Each lead stays with the card&apos;s seat, even if the person moves on.
          </p>
        </div>
        {leads.length > 0 ? (
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal/50 dark:text-warm-paper/50" aria-hidden="true" />
            <label htmlFor="leads-search" className="sr-only">
              Search leads
            </label>
            <Input id="leads-search" type="search" placeholder="Search leads" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="px-4 py-3 rounded-panel border border-error/40 bg-error/10 text-sm">
          {error}
        </div>
      ) : loading ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={72} />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={<Inbox className="w-6 h-6" aria-hidden="true" />}
          title="No leads yet"
          description="When a visitor taps Share your details on a card, they appear here."
        />
      ) : (
        <ul className="rounded-panel border border-sand-border dark:border-sand-border/30 divide-y divide-sand-border dark:divide-sand-border/30 overflow-hidden">
          {visible.map((lead) => (
            <li key={lead.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center px-4 py-3 bg-warm-paper dark:bg-charcoal">
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{lead.name}</div>
                <div className="text-sm text-charcoal/70 dark:text-warm-paper/70 truncate">
                  {lead.company || 'No company given'}
                  {lead.note ? ` · “${lead.note}”` : ''}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1.5 min-h-[44px] font-semibold underline underline-offset-2">
                  <Phone className="w-4 h-4" aria-hidden="true" />
                  {lead.phone}
                </a>
                {lead.email ? (
                  <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 min-h-[44px] underline underline-offset-2 truncate">
                    <Mail className="w-4 h-4" aria-hidden="true" />
                    {lead.email}
                  </a>
                ) : null}
              </div>
              <div className="text-xs text-charcoal/60 dark:text-warm-paper/60 sm:text-right">
                <div>For {lead.ownerName || 'a card'}</div>
                <div>
                  <time dateTime={lead.createdAt}>{formatRelativeTime(lead.createdAt)}</time>
                  {lead.sourceTag ? ` · ${lead.sourceTag.replace(/_/g, ' ')}` : ''}
                </div>
              </div>
            </li>
          ))}
          {visible.length === 0 ? <li className="px-4 py-6 text-sm text-center text-charcoal/70 dark:text-warm-paper/70">No leads match this search.</li> : null}
        </ul>
      )}
    </div>
  );
};
