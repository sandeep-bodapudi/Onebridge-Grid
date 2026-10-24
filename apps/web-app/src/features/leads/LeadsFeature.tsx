'use client';

import React, { useEffect, useState } from 'react';
import { Inbox, Phone, Mail, Search } from 'lucide-react';
import { Avatar, EmptyState, Input, PageHeader, Skeleton, formatRelativeTime } from '@onebridge/ui-kit';
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
      <PageHeader
        className="mb-6"
        title="Leads"
        subtitle="People who shared their details from a card. Each lead stays with the card's seat, even if the person moves on."
        actions={
          leads.length > 0 ? (
            <div className="relative sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" aria-hidden="true" />
              <label htmlFor="leads-search" className="sr-only">
                Search leads
              </label>
              <Input id="leads-search" type="search" placeholder="Search leads" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 rounded-[10px]" />
            </div>
          ) : null
        }
      />

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
        <ul className="rounded-[14px] border border-white/[0.08] bg-charcoal overflow-hidden">
          {visible.map((lead, idx) => (
            <li
              key={lead.id}
              className={`grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-4 gap-y-1 items-center px-5 py-4 ${idx > 0 ? 'border-t border-white/[0.08]' : ''}`}
            >
              <Avatar name={lead.name} />
              <div className="min-w-0">
                <div className="text-sm font-bold">{lead.name}</div>
                <div className="text-[13px] text-warm-paper/60">
                  {[lead.company, lead.ownerName ? `via ${lead.ownerName}` : null, lead.sourceTag ? lead.sourceTag.replace(/_/g, ' ') : null].filter(Boolean).join(' · ')}
                </div>
                {lead.note ? <div className="text-[13px] text-warm-paper/80 mt-1">“{lead.note}”</div> : null}
                <div className="flex flex-wrap gap-x-4 text-[13px] mt-1 sm:hidden">
                  <span className="tabular-nums">{lead.phone}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <div className="text-sm font-semibold tabular-nums select-all">{lead.phone}</div>
                  <time dateTime={lead.createdAt} className="text-xs text-warm-paper/45">
                    {formatRelativeTime(lead.createdAt)}
                  </time>
                </div>
                {lead.email ? (
                  <a
                    href={`mailto:${lead.email}`}
                    aria-label={`Email ${lead.name}`}
                    className="w-10 h-10 rounded-[10px] border border-white/15 inline-flex items-center justify-center hover:bg-white/5"
                  >
                    <Mail className="w-4 h-4" aria-hidden="true" />
                  </a>
                ) : null}
                <a
                  href={`tel:${lead.phone}`}
                  aria-label={`Call ${lead.name}`}
                  className="w-10 h-10 rounded-[10px] bg-bridge-orange text-[#241A10] inline-flex items-center justify-center hover:brightness-105"
                >
                  <Phone className="w-4 h-4" aria-hidden="true" />
                </a>
              </div>
            </li>
          ))}
          {visible.length === 0 ? <li className="px-5 py-8 text-sm text-center text-warm-paper/60">No leads match this search.</li> : null}
        </ul>
      )}
    </div>
  );
};
