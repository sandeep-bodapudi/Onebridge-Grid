'use client';

import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Circle } from 'lucide-react';
import {
  Button,
  Skeleton,
  SpanLine,
  StatTile,
  describeAuditAction,
  auditSubjectName,
  formatRelativeTime,
  cn,
} from '@onebridge/ui-kit';
import type { CardSummary, LeadSummary, OverviewStats } from '@onebridge/api-contracts';
import { apiClient } from '../../api-client';

export interface OverviewFeatureProps {
  tenantId: string;
  isAdmin: boolean;
  companyName: string;
  selfPersonId?: string;
  selfName?: string;
  /** Switches the dashboard to another section. */
  onNavigate: (section: 'cards' | 'seats' | 'structure' | 'brand' | 'audit' | 'leads') => void;
  className?: string;
}

interface ActivityItem {
  id: string;
  text: React.ReactNode;
  at: string;
}

export const OverviewFeature: React.FC<OverviewFeatureProps> = ({
  tenantId,
  isAdmin,
  companyName,
  selfPersonId,
  selfName,
  onNavigate,
  className,
}) => {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [branchCount, setBranchCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const leadsEnabled = isAdmin && apiClient.leadsPanelEnabled();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [overview, cardList, leadList, audit, seats, branches] = await Promise.all([
          apiClient.getOverviewStats(tenantId),
          apiClient.listCardSummaries(tenantId).catch(() => [] as CardSummary[]),
          leadsEnabled ? apiClient.listLeads(tenantId).catch(() => [] as LeadSummary[]) : Promise.resolve([] as LeadSummary[]),
          isAdmin ? apiClient.getAuditLogs(tenantId, { limit: 6 }).catch(() => null) : Promise.resolve(null),
          isAdmin ? apiClient.listSeats(tenantId, { limit: 100 }).catch(() => null) : Promise.resolve(null),
          isAdmin ? apiClient.listBranches(tenantId).catch(() => []) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setStats(overview);
        setCards(cardList);
        setLeads(leadList);
        setBranchCount(branches.length);

        const nameBySeat = new Map(cardList.map((c) => [c.seatId || c.id, c.name]));
        const names = new Map<string, string>();
        for (const seat of seats?.items || []) {
          const name = nameBySeat.get(seat.id);
          if (seat.personId && name) names.set(seat.personId, name);
        }
        if (selfPersonId && selfName && !names.has(selfPersonId)) names.set(selfPersonId, selfName);

        const auditItems: ActivityItem[] = (audit?.items || []).map((e) => {
          const actor = names.get(e.actorPersonId || e.actor || '') || 'A team member';
          const subject = auditSubjectName({ after: e.after as Record<string, unknown> | null, before: e.before as Record<string, unknown> | null });
          return {
            id: e.id,
            at: e.occurredAt,
            text: (
              <>
                <span className="font-bold">{actor}</span> {describeAuditAction(e.action)}
                {subject ? <span className="font-bold"> {subject}</span> : null}
              </>
            ),
          };
        });
        const leadItems: ActivityItem[] = leadList.slice(0, 4).map((l) => ({
          id: `lead-${l.id}`,
          at: l.createdAt,
          text: (
            <>
              <span className="font-bold">{l.name}</span>
              {l.company ? ` from ${l.company}` : ''} shared their details with <span className="font-bold">{l.ownerName || 'a card'}</span>
            </>
          ),
        }));
        setActivity([...auditItems, ...leadItems].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the overview');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, isAdmin, leadsEnabled, selfPersonId, selfName]);

  const published = stats?.cards.published ?? 0;
  const total = stats?.cards.total ?? 0;
  const namedCards = cards.filter((c) => c.name.trim()).length;

  const steps = [
    { done: total > 0, label: 'Add a seat for each person who needs a card', action: 'seats' as const, cta: 'Add people' },
    { done: namedCards > 0 && namedCards === total, label: 'Fill in names and phone numbers on every card', action: 'cards' as const, cta: 'Edit cards' },
    { done: published > 0, label: 'Publish cards so their QR codes work', action: 'cards' as const, cta: 'Publish' },
    { done: branchCount > 0, label: 'Add your branch address for the Directions button', action: 'structure' as const, cta: 'Add branch' },
  ];
  const remaining = steps.filter((s) => !s.done);

  if (error) {
    return (
      <div role="alert" className="px-4 py-3 rounded-panel border border-error/40 bg-error/10 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className={cn('space-y-8', className)} data-testid="overview-feature">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Cards live"
          value={loading ? '' : `${published} of ${total}`}
          isLoading={loading}
          progressPercent={total ? Math.round((published / total) * 100) : 0}
          subtext={total - published > 0 ? `${total - published} still in draft` : 'Every card is published'}
        />
        <StatTile label="Card views" value={stats?.views ?? 0} isLoading={loading} subtext="Since you started" />
        <StatTile label="Contacts saved" value={stats?.saves ?? 0} isLoading={loading} subtext="Visitors who tapped Save contact" />
        <StatTile label="Leads" value={stats?.leads ?? 0} isLoading={loading} highlight={(stats?.leads ?? 0) > 0} subtext="Visitors who shared their details" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        <section className="space-y-3" aria-labelledby="overview-activity">
          <div className="flex items-center justify-between">
            <h2 id="overview-activity" className="text-base font-bold">
              Recent activity
            </h2>
            {isAdmin ? (
              <Button variant="ghost" onClick={() => onNavigate('audit')} className="gap-1.5 text-sm">
                Audit log <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={48} />
              ))}
            </div>
          ) : activity.length === 0 ? (
            <p className="px-4 py-6 rounded-panel border border-dashed border-sand-border dark:border-sand-border/30 text-sm text-charcoal/70 dark:text-warm-paper/70">
              Nothing yet. Changes to {companyName} and new leads will appear here.
            </p>
          ) : (
            <ol className="rounded-panel border border-sand-border dark:border-sand-border/30 divide-y divide-sand-border dark:divide-sand-border/30 overflow-hidden">
              {activity.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4 px-4 py-3 bg-warm-paper dark:bg-charcoal">
                  <p className="text-sm min-w-0">{item.text}</p>
                  <time dateTime={item.at} className="text-xs text-charcoal/60 dark:text-warm-paper/60 shrink-0 pt-0.5">
                    {formatRelativeTime(item.at)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </section>

        {isAdmin ? (
          <section className="space-y-3" aria-labelledby="overview-setup">
            <h2 id="overview-setup" className="text-base font-bold">
              {remaining.length === 0 ? 'Setup complete' : 'Finish setting up'}
            </h2>
            <SpanLine className="my-0" progressPercent={(steps.filter((s) => s.done).length / steps.length) * 100} />
            <ul className="space-y-2">
              {steps.map((step) => (
                <li key={step.label} className="flex items-center gap-3 min-h-[44px]">
                  {step.done ? (
                    <span className="w-5 h-5 shrink-0 rounded-control bg-success text-white flex items-center justify-center">
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  ) : (
                    <Circle className="w-5 h-5 shrink-0 text-charcoal/30 dark:text-warm-paper/30" aria-hidden="true" />
                  )}
                  <span className={cn('text-sm flex-1', step.done && 'text-charcoal/60 dark:text-warm-paper/60 line-through')}>
                    <span className="sr-only">{step.done ? 'Done: ' : 'To do: '}</span>
                    {step.label}
                  </span>
                  {!step.done && !loading ? (
                    <Button variant="ghost" className="text-sm shrink-0" onClick={() => onNavigate(step.action)}>
                      {step.cta}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            {leadsEnabled && leads.length > 0 ? (
              <Button variant="secondary" isFullWidth onClick={() => onNavigate('leads')} className="gap-2 mt-2">
                View {leads.length} {leads.length === 1 ? 'lead' : 'leads'} <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Button>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
};
