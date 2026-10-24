'use client';

import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, FileText, Phone, Plus, QrCode, TrendingDown, TrendingUp, UserPlus } from 'lucide-react';
import {
  Avatar,
  Button,
  PageHeader,
  Skeleton,
  TrendBars,
  describeAuditAction,
  auditSubjectName,
  formatRelativeTime,
  greetingFor,
  cn,
} from '@onebridge/ui-kit';
import type { CardSummary, LeadSummary, OverviewStats } from '@onebridge/api-contracts';
import { apiClient } from '../../api-client';

export interface OverviewFeatureProps {
  tenantId: string;
  isAdmin: boolean;
  companyName: string;
  firstName: string;
  selfPersonId?: string;
  selfName?: string;
  /** Switches the dashboard to another section. */
  onNavigate: (section: 'cards' | 'seats' | 'structure' | 'brand' | 'audit' | 'leads') => void;
  /** Opens a person's card in the card studio. */
  onEditCard?: (seatId: string) => void;
  className?: string;
}

interface ActivityItem {
  id: string;
  text: React.ReactNode;
  at: string;
}

const panel = 'rounded-[14px] bg-charcoal border border-white/[0.08]';

function Delta({ now, before, unit }: { now: number; before: number; unit: string }) {
  if (before === 0 && now === 0) return <span className="text-xs text-warm-paper/45">No activity yet</span>;
  if (before === 0) {
    return <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md bg-success/20 text-[#8FD7AE]">New this fortnight</span>;
  }
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return <span className="inline-flex text-xs font-bold px-2 py-0.5 rounded-md bg-white/10 text-warm-paper/70">Same as previous 14 days</span>;
  const up = pct > 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md',
        up ? 'bg-success/20 text-[#8FD7AE]' : 'bg-white/10 text-warm-paper/70'
      )}
    >
      {up ? <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" /> : <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />}
      {up ? '+' : ''}
      {pct}% <span className="font-semibold opacity-80 hidden sm:inline">vs previous 14 days</span>
      <span className="sr-only"> ({before} {unit} before)</span>
    </span>
  );
}

export const OverviewFeature: React.FC<OverviewFeatureProps> = ({
  tenantId,
  isAdmin,
  companyName,
  firstName,
  selfPersonId,
  selfName,
  onNavigate,
  onEditCard,
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
        setActivity(
          (audit?.items || []).map((e) => {
            const actor = names.get(e.actorPersonId || e.actor || '') || 'A team member';
            const subject = auditSubjectName({ after: e.after as Record<string, unknown> | null, before: e.before as Record<string, unknown> | null });
            return {
              id: e.id,
              at: e.occurredAt,
              text: (
                <>
                  <span className="font-semibold text-warm-paper">{actor}</span> {describeAuditAction(e.action)}
                  {subject ? <span className="font-semibold text-warm-paper"> {subject}</span> : null}
                </>
              ),
            };
          })
        );
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

  const period = stats?.period;
  const drafts = cards.filter((c) => c.status !== 'published');
  const unnamed = cards.filter((c) => !c.name.trim());
  const steps = [
    cards.length === 0 && { key: 'seat', title: 'Add the people who need cards', body: 'Each person gets a card, a QR code and a short link.', action: () => onNavigate('seats'), cta: 'Add people', icon: UserPlus },
    unnamed.length > 0 && { key: 'names', title: `Fill in ${unnamed.length === 1 ? 'one card' : `${unnamed.length} cards`}`, body: 'Cards without a name or phone number cannot be saved by visitors.', action: () => onNavigate('cards'), cta: 'Open card studio', icon: FileText },
    drafts.length > 0 && {
      key: 'publish',
      title: drafts.length === 1 ? `Publish ${drafts[0].name || 'one card'}'s card` : `Publish ${drafts.length} draft cards`,
      body: 'A draft card\'s QR code does not work yet.',
      action: () => (drafts.length === 1 && onEditCard ? onEditCard(drafts[0].seatId || drafts[0].id) : onNavigate('cards')),
      cta: 'Publish',
      icon: FileText,
    },
    branchCount === 0 && { key: 'branch', title: 'Add your branch address', body: 'Cards use it for the Directions button.', action: () => onNavigate('structure'), cta: 'Add branch', icon: Plus },
    { key: 'standee', title: 'Print a QR standee for each counter', body: 'One QR per counter or event shows which one brings in leads.', action: () => onNavigate('cards'), cta: 'Get QR codes', icon: QrCode },
  ].filter(Boolean) as Array<{ key: string; title: string; body: string; action: () => void; cta: string; icon: typeof Plus }>;

  const top = stats?.topCards ?? [];
  const topMax = Math.max(1, ...top.map((t) => t.views));

  if (error) {
    return (
      <div role="alert" className="px-4 py-3 rounded-xl border border-error/40 bg-error/10 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)} data-testid="overview-feature">
      <PageHeader
        title={`${greetingFor()}, ${firstName}`}
        subtitle={`${companyName} · last 14 days`}
        actions={
          isAdmin ? (
            <Button variant="primary" className="gap-2" onClick={() => onNavigate('seats')}>
              <Plus className="w-4 h-4" aria-hidden="true" />
              Add person
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        {/* Performance */}
        <section className={cn(panel, 'relative overflow-hidden p-5 md:p-6')} aria-labelledby="ov-performance">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-bridge-orange" />
          <h2 id="ov-performance" className="text-sm font-semibold text-warm-paper/60">
            Card performance
          </h2>
          {loading || !period ? (
            <div className="space-y-4 mt-4">
              <Skeleton height={64} />
              <Skeleton height={150} />
            </div>
          ) : (
            <>
              <dl className="grid grid-cols-3 gap-3 sm:gap-5 mt-3">
                {[
                  { label: 'Card views', now: period.views, before: period.previousViews, unit: 'views' },
                  { label: 'Contacts saved', now: period.saves, before: period.previousSaves, unit: 'saves' },
                  { label: 'Leads', now: period.leads, before: period.previousLeads, unit: 'leads' },
                ].map((m) => (
                  <div key={m.label}>
                    {/* dt before dd in the markup; shown number-first */}
                    <div className="flex flex-col-reverse">
                      <dt className="text-sm text-warm-paper/60 mt-1.5">{m.label}</dt>
                      <dd className="m-0 text-[32px] sm:text-[44px] leading-none font-bold tracking-[-0.035em] tabular-nums">{m.now}</dd>
                    </div>
                    <div className="mt-2">
                      <Delta now={m.now} before={m.before} unit={m.unit} />
                    </div>
                  </div>
                ))}
              </dl>
              <TrendBars
                className="mt-5"
                title="Card views and saves per day, last 14 days"
                primaryLabel="Views"
                secondaryLabel="Saves"
                points={(stats?.daily ?? []).map((d) => ({ date: d.date, primary: d.views, secondary: d.saves }))}
              />
            </>
          )}
        </section>

        {/* Leads (or activity when the leads panel is off) */}
        <section className={cn(panel, 'flex flex-col')} aria-labelledby="ov-leads">
          <div className="flex items-center justify-between px-5 pt-4">
            <h2 id="ov-leads" className="text-[15px] font-bold">
              {leadsEnabled ? 'New leads' : 'Recent activity'}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate(leadsEnabled ? 'leads' : 'audit')}
              className="inline-flex items-center gap-1 min-h-[44px] text-sm font-semibold text-warm-paper/60 hover:text-warm-paper"
            >
              {leadsEnabled ? 'All leads' : 'Audit log'} <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={44} />
              ))}
            </div>
          ) : leadsEnabled ? (
            leads.length === 0 ? (
              <p className="px-5 pb-6 pt-2 text-sm text-warm-paper/60">
                No leads yet. When a visitor taps <span className="font-semibold text-warm-paper">Share your details</span> on a card, they appear here.
              </p>
            ) : (
              <ul className="pb-2">
                {leads.slice(0, 5).map((l, i) => {
                  const fresh = Date.now() - new Date(l.createdAt).getTime() < 86_400_000;
                  return (
                    <li key={l.id} className={cn('grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center px-5 py-3', i > 0 && 'border-t border-white/[0.08]')}>
                      <Avatar name={l.name} size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate">
                          {fresh ? <span aria-label="New" className="inline-block w-[7px] h-[7px] rounded-[2px] bg-bridge-orange mr-1.5 align-[1px]" /> : null}
                          {l.name}
                        </div>
                        <div className="text-[13px] text-warm-paper/60 truncate">
                          {l.note ? `“${l.note}”` : [l.company, l.ownerName ? `via ${l.ownerName}` : null].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs text-warm-paper/45 hidden sm:inline">{formatRelativeTime(l.createdAt)}</span>
                        <a
                          href={`tel:${l.phone}`}
                          aria-label={`Call ${l.name}`}
                          className="w-9 h-9 rounded-[9px] border border-white/15 inline-flex items-center justify-center hover:bg-white/5"
                        >
                          <Phone className="w-4 h-4" aria-hidden="true" />
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          ) : activity.length === 0 ? (
            <p className="px-5 pb-6 pt-2 text-sm text-warm-paper/60">Nothing yet. Changes to {companyName} will appear here.</p>
          ) : (
            <ul className="pb-2">
              {activity.map((item, i) => (
                <li key={item.id} className={cn('flex justify-between gap-4 px-5 py-3 text-sm text-warm-paper/70', i > 0 && 'border-t border-white/[0.08]')}>
                  <span className="min-w-0">{item.text}</span>
                  <time dateTime={item.at} className="text-xs text-warm-paper/45 shrink-0 pt-0.5">
                    {formatRelativeTime(item.at)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={cn(panel, 'pb-2')} aria-labelledby="ov-top">
          <div className="flex items-center justify-between px-5 pt-4">
            <h2 id="ov-top" className="text-[15px] font-bold">
              Top cards this fortnight
            </h2>
            {isAdmin ? (
              <button type="button" onClick={() => onNavigate('seats')} className="inline-flex items-center gap-1 min-h-[44px] text-sm font-semibold text-warm-paper/60 hover:text-warm-paper">
                People <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              <Skeleton height={36} />
              <Skeleton height={36} />
            </div>
          ) : top.length === 0 ? (
            <p className="px-5 pb-4 pt-2 text-sm text-warm-paper/60">No card views yet. Share a card link or print its QR code.</p>
          ) : (
            <ol className="mt-1">
              {top.slice(0, 4).map((t, i) => (
                <li key={t.id} className="grid grid-cols-[18px_auto_minmax(0,1fr)_48px] gap-3 items-center px-5 py-2.5">
                  <span className="text-[13px] font-bold text-warm-paper/45 tabular-nums">{i + 1}</span>
                  <Avatar name={t.name || '—'} size="sm" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold truncate">{t.name || 'Name not added yet'}</span>
                    <span className="block h-1.5 rounded-[3px] bg-[#393536] mt-1.5 overflow-hidden">
                      <span className="block h-full bg-bridge-orange" style={{ width: `${(t.views / topMax) * 100}%` }} />
                    </span>
                  </span>
                  <span className="text-right font-bold tabular-nums">{t.views}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className={cn(panel, 'p-5 flex flex-col gap-3')} aria-labelledby="ov-next">
          <h2 id="ov-next" className="text-[15px] font-bold">
            Next steps
          </h2>
          {steps.slice(0, 2).map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                type="button"
                onClick={s.action}
                className="flex gap-3 items-start text-left p-3.5 rounded-xl bg-charcoal-deep border border-white/[0.08] hover:border-white/20 transition-colors"
              >
                <span className="w-[34px] h-[34px] rounded-[9px] bg-bridge-orange/15 text-bridge-orange inline-flex items-center justify-center shrink-0">
                  <Icon className="w-[17px] h-[17px]" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{s.title}</span>
                  <span className="block text-[13px] text-warm-paper/60">{s.body}</span>
                </span>
              </button>
            );
          })}
          {cards.length > 0 && drafts.length === 0 && unnamed.length === 0 ? (
            <p className="flex items-center gap-2 text-[13px] text-warm-paper/60">
              <Check className="w-4 h-4 text-[#8FD7AE]" aria-hidden="true" /> Every card is published.
            </p>
          ) : null}
        </section>

        <section className={cn(panel, 'p-5 flex flex-col justify-between gap-4')} aria-labelledby="ov-qr">
          <div className="flex items-center justify-between">
            <h2 id="ov-qr" className="text-[15px] font-bold">
              Saved to phones
            </h2>
            <span className="text-xs text-warm-paper/45">all time</span>
          </div>
          {loading || !stats ? (
            <Skeleton height={60} />
          ) : (
            <div className="flex items-end gap-4">
              <div>
                <div className="text-[34px] leading-none font-bold tracking-[-0.03em] tabular-nums">{stats.saves}</div>
                <div className="text-[13px] text-warm-paper/60 mt-1.5">contacts saved from {stats.views} card views</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-[22px] leading-none font-bold tabular-nums">{stats.views ? Math.round((stats.saves / stats.views) * 100) : 0}%</div>
                <div className="text-xs text-warm-paper/45 mt-1">save rate</div>
              </div>
            </div>
          )}
          <Button variant="secondary" isFullWidth onClick={() => onNavigate('cards')} className="gap-2">
            <QrCode className="w-4 h-4" aria-hidden="true" />
            QR codes and standees
          </Button>
        </section>
      </div>
    </div>
  );
};
