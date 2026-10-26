import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, Lock, MoreHorizontal, Pencil, Plus, Search, UserPlus, Users, WifiOff } from 'lucide-react';
import { Avatar } from './AppShell';
import { cn } from './ActionButton';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { StatusChip } from './StatusChip';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';
import { SlideOverPanel } from './SlideOverPanel';
import { ConfirmDialog } from './ConfirmDialog';

export interface SeatItem {
  id: string; // e.g. OB-7KQ2MX-E0001
  tenantId: string;
  title: string;
  branchId?: string | null;
  departmentId?: string | null;
  teamId?: string | null;
  managerSeatId?: string | null;
  personId?: string | null;
  status: 'vacant' | 'invited' | 'active' | 'inactive' | 'offboarded';
  isReadOnly: boolean;
  cardBinding?: {
    cardId?: string | null;
    cardUrl?: string | null;
    qrCodeUrl?: string | null;
    nfcChipId?: string | null;
  } | null;
  /** Name shown on the seat's card (from the cards service). */
  displayName?: string;
  /** Status of the seat's card. */
  cardStatus?: 'draft' | 'pending_approval' | 'published' | 'inactive';
  /** Real visitor page URL of the seat's card. */
  cardPublicUrl?: string;
  /** The card's results over the last 14 days. */
  stats?: { views: number; saves: number; leads: number; daily: number[] };
  createdAt: string;
  updatedAt: string;
}

export interface NewSeatInput {
  title: string;
  name?: string;
  phone?: string;
  email?: string;
  branchId?: string;
  departmentId?: string;
  teamId?: string;
  personId?: string;
  managerSeatId?: string;
}

export interface SeatsManagementLabels {
  title: string;
  subtitle: string;
  addSeat: string;
  addVacantSeat: string;
  emptyTitle: string;
  emptyDesc: string;
  overLimitWarningTitle: string;
  overLimitWarningDesc: string;
  offlineBanner: string;
  assignPerson: string;
  reassignPerson: string;
  statusVacant: string;
  statusInvited: string;
  statusActive: string;
  statusInactive: string;
  statusOffboarded: string;
  readOnlyBadge: string;
  cardBindingTitle: string;
  seatIdLabel: string;
  personAssignedLabel: string;
  noPersonAssigned: string;
  cancel: string;
  save: string;
  assignPersonTitle: string;
  assignPersonDesc: string;
  personIdPlaceholder: string;
  upgradePlan: string;
}

export const defaultSeatsLabelsEn: SeatsManagementLabels = {
  title: 'People',
  subtitle: 'Each card belongs to a company seat, so its link, QR codes and leads stay when people change.',
  addSeat: 'Add person',
  addVacantSeat: 'Create vacant seat',
  emptyTitle: 'No seats yet',
  emptyDesc: 'Add a seat for each person who needs a card. The seat keeps the card, QR codes and leads even when people change.',
  overLimitWarningTitle: 'Plan seat limit reached',
  overLimitWarningDesc: 'Extra seats stay visible but read-only. Upgrade your plan to add or edit them.',
  offlineBanner: 'You are currently offline. Viewing cached seats and people.',
  assignPerson: 'Invite by phone',
  reassignPerson: 'Invite by phone',
  statusVacant: 'Not signed in yet',
  statusInvited: 'Invited',
  statusActive: 'Signed in',
  statusInactive: 'Inactive',
  statusOffboarded: 'Offboarded',
  readOnlyBadge: 'Read-only',
  cardBindingTitle: 'Card',
  seatIdLabel: 'Seat ID',
  personAssignedLabel: 'Person',
  noPersonAssigned: 'No one yet',
  cancel: 'Cancel',
  save: 'Save',
  assignPersonTitle: 'Invite by phone',
  assignPersonDesc: 'Until then, fill in the card details yourself.',
  personIdPlaceholder: 'Name',
  upgradePlan: 'Upgrade plan',
};

export const seatsLabelsHi: Partial<SeatsManagementLabels> = {
  title: 'सीटें और लोग',
  subtitle: 'प्रत्येक डिजिटल कार्ड और NFC चिप कंपनी के स्वामित्व वाली सीट से जुड़ी होती है।',
  addSeat: 'सीट जोड़ें',
  addVacantSeat: 'रिक्त सीट बनाएं',
  emptyTitle: 'अभी तक कोई सीट कॉन्फ़िगर नहीं की गई है',
  emptyDesc:
    'सीटें कंपनी की होती हैं और कर्मचारियों के बदलने पर भी कार्ड, क्यूआर कोड, एनएफसी चिप और लीड इतिहास सुरक्षित रखती हैं।',
  overLimitWarningTitle: 'योजना सीट सीमा समाप्त',
  overLimitWarningDesc:
    'आप अपनी सीट सीमा तक पहुँच चुके हैं। अतिरिक्त सीटें केवल-पढ़ने योग्य रखी जाती हैं। योजना अपग्रेड करें।',
  offlineBanner: 'आप वर्तमान में ऑफ़लाइन हैं। कैश्ड सीटें देखी जा रही हैं।',
  assignPerson: 'फ़ोन से आमंत्रित करें',
  reassignPerson: 'फ़ोन से आमंत्रित करें',
  statusVacant: 'रिक्त',
  statusInvited: 'आमंत्रित',
  statusActive: 'सक्रिय',
  statusInactive: 'निष्क्रिय',
  statusOffboarded: 'ऑफबोर्डेड',
  readOnlyBadge: 'केवल-पढ़ने योग्य',
  cardBindingTitle: 'कार्ड',
  seatIdLabel: 'सीट आईडी',
  personAssignedLabel: 'व्यक्ति',
  noPersonAssigned: 'अभी कोई नहीं',
  cancel: 'रद्द करें',
  save: 'सहेजें',
  upgradePlan: 'योजना अपग्रेड करें',
};

export interface SeatsManagementProps {
  seats: SeatItem[];
  total?: number;
  plan?: 'starter' | 'business' | 'enterprise';
  maxSeats?: number;
  isLoading?: boolean;
  isOffline?: boolean;
  error?: string | null;
  labels?: Partial<SeatsManagementLabels>;
  onCreateSeat?: (dto: NewSeatInput) => Promise<void> | void;
  /** Kept for API compatibility; inviting people (F14) is not offered yet. */
  onAssignPerson?: (seatId: string, personId: string) => Promise<void> | void;
  onUpdateStatus?: (seatId: string, status: SeatItem['status']) => Promise<void> | void;
  onArchiveSeat?: (seatId: string) => Promise<void> | void;
  /** Opens the card editor for a seat. */
  onEditCard?: (seatId: string) => void;
  /** F14: invite controls for a seat (send, resend, cancel), shown in the seat's detail panel. */
  renderInvite?: (seat: SeatItem) => React.ReactNode;
  branches?: Array<{ id: string; name: string }>;
  departments?: Array<{ id: string; name: string }>;
  teams?: Array<{ id: string; name: string }>;
  className?: string;
}

type Filter = 'all' | 'live' | 'draft' | 'paused';


const PHONE_PATTERN = /^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/;

export const SeatsManagement: React.FC<SeatsManagementProps> = ({
  seats,
  total = seats.length,
  plan = 'starter',
  maxSeats = plan === 'starter' ? 5 : plan === 'business' ? 1000 : 100000,
  isLoading = false,
  isOffline = false,
  error = null,
  labels: customLabels,
  onCreateSeat,
  onUpdateStatus,
  onArchiveSeat,
  onEditCard,
  renderInvite,
  branches = [],
  departments = [],
  teams = [],
  className,
}) => {
  const labels: SeatsManagementLabels = { ...defaultSeatsLabelsEn, ...customLabels };
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<NewSeatInput>({ title: '' });
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [managed, setManaged] = useState<SeatItem | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState('');
  // Wide screens show the selected person beside the table; smaller ones open a panel.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  const [confirmSeat, setConfirmSeat] = useState<SeatItem | null>(null);

  const liveSeats = seats.filter((s) => s.status !== 'offboarded');
  const hasOverLimitSeats = seats.some((s) => s.isReadOnly) || total > maxSeats;
  const atLimit = liveSeats.length >= maxSeats;

  const statusLabel: Record<SeatItem['status'], string> = {
    vacant: labels.statusVacant,
    invited: labels.statusInvited,
    active: labels.statusActive,
    inactive: labels.statusInactive,
    offboarded: labels.statusOffboarded,
  };
  const cardChip = (seat: SeatItem) => {
    if (!seat.cardStatus) return <span className="text-sm text-charcoal/50 dark:text-warm-paper/50">—</span>;
    if (seat.cardStatus === 'published') return <StatusChip status="published">Live</StatusChip>;
    if (seat.cardStatus === 'pending_approval') return <StatusChip status="info">Waiting for approval</StatusChip>;
    if (seat.cardStatus === 'inactive') return <StatusChip status="archived">Inactive</StatusChip>;
    return <StatusChip status="draft">Draft</StatusChip>;
  };

  const filterOf = (s: SeatItem): Filter =>
    s.status === 'inactive' || s.status === 'offboarded' ? 'paused' : s.cardStatus === 'published' ? 'live' : 'draft';
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: seats.length, live: 0, draft: 0, paused: 0 };
    for (const s of seats) c[filterOf(s)]++;
    return c;
  }, [seats]);

  const filterOptions: Array<{ value: Filter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'live', label: 'Live' },
    { value: 'draft', label: 'Draft' },
    { value: 'paused', label: 'Paused' },
  ];

  const visible = seats.filter((s) => {
    if (filter !== 'all' && filterOf(s) !== filter) return false;
    if (branchFilter && s.branchId !== branchFilter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [s.displayName, s.title, branches.find((b) => b.id === s.branchId)?.name]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  const nameOf = (seat: SeatItem) => seat.displayName?.trim() || labels.noPersonAssigned;
  const managedSeat = managed ? seats.find((s) => s.id === managed.id) ?? managed : null;
  const branchOf = (seat: SeatItem) => branches.find((b) => b.id === seat.branchId)?.name;

  const validateDraft = (d: NewSeatInput) => {
    const errs: Record<string, string> = {};
    if (!d.title.trim()) errs.title = 'Enter a job title for this seat.';
    if (d.phone && !PHONE_PATTERN.test(d.phone.trim())) errs.phone = 'Enter a 10-digit Indian mobile number.';
    if (d.email && !/^\S+@\S+\.\S+$/.test(d.email.trim())) errs.email = 'Enter an email address like name@company.com.';
    return errs;
  };

  const blurField = (field: keyof NewSeatInput) => {
    const errs = validateDraft(draft);
    setDraftErrors((prev) => ({ ...prev, [field]: errs[field] || '' }));
  };

  const submitDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateDraft(draft);
    setDraftErrors(errs);
    if (Object.values(errs).some(Boolean) || !onCreateSeat) return;
    setSubmitting(true);
    try {
      await onCreateSeat({
        ...draft,
        title: draft.title.trim(),
        name: draft.name?.trim() || undefined,
        phone: draft.phone?.trim() || undefined,
        email: draft.email?.trim() || undefined,
        branchId: draft.branchId || undefined,
        departmentId: draft.departmentId || undefined,
        teamId: draft.teamId || undefined,
      });
      setAddOpen(false);
      setDraft({ title: '' });
      setDraftErrors({});
    } catch {
      // The host shows the error; keep the form open.
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div data-testid="seats-loading" className={cn('space-y-4', className)} aria-busy="true">
        <Skeleton width="40%" height={32} />
        <Skeleton height={44} />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={64} />
        ))}
      </div>
    );
  }

  const selected = seats.find((s) => s.id === selectedId) ?? visible[0] ?? null;
  const live = seats.filter((s) => s.cardStatus === 'published').length;

  const Sparkline: React.FC<{ data?: number[] }> = ({ data }) => {
    const values = data && data.length ? data : new Array(14).fill(0);
    const max = Math.max(4, ...values);
    const pts = values.map((v, i) => `${((i * 64) / (values.length - 1)).toFixed(1)},${(22 - (v / max) * 20).toFixed(1)}`).join(' ');
    const any = values.some((v) => v > 0);
    return (
      <svg width="64" height="24" viewBox="0 0 64 24" aria-hidden="true" className="shrink-0">
        <polyline points={pts} fill="none" stroke={any ? '#F68713' : 'rgba(250,247,242,0.2)'} strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  };

  const cardPill = (seat: SeatItem) => {
    if (seat.status === 'inactive') return <StatusChip status="warning">Paused</StatusChip>;
    if (seat.status === 'offboarded') return <StatusChip status="archived">{labels.statusOffboarded}</StatusChip>;
    return cardChip(seat);
  };

  const detail = (seat: SeatItem) => (
    <div className="space-y-5" data-testid="manage-seat-panel">
      <div className="flex items-center gap-3.5">
        <Avatar name={seat.displayName || ''} size="xl" />
        <div className="min-w-0">
          <h3 className="text-xl font-bold tracking-tight">{nameOf(seat)}</h3>
          <p className="text-sm text-charcoal/70 dark:text-warm-paper/60">{seat.title}</p>
        </div>
      </div>
      <div className="text-xs text-charcoal/55 dark:text-warm-paper/45 -mb-3">Last 14 days</div>
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Views', seat.stats?.views ?? 0],
          ['Saves', seat.stats?.saves ?? 0],
          ['Leads', seat.stats?.leads ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[10px] border border-sand-border dark:border-white/[0.08] bg-sand/30 dark:bg-charcoal-deep px-3 py-2.5">
            <div className="text-xl font-bold tabular-nums tracking-tight">{value}</div>
            <div className="text-xs text-charcoal/60 dark:text-warm-paper/55">{label}</div>
          </div>
        ))}
      </div>
      <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2.5 text-sm">
        <dt className="text-charcoal/60 dark:text-warm-paper/45">Branch</dt>
        <dd>{branchOf(seat) || '—'}</dd>
        <dt className="text-charcoal/60 dark:text-warm-paper/45">Card</dt>
        <dd className="flex flex-wrap items-center gap-2">
          {cardPill(seat)}
          {seat.cardPublicUrl && seat.cardStatus === 'published' ? (
            <a href={seat.cardPublicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-2">
              Open card <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </dd>
        <dt className="text-charcoal/60 dark:text-warm-paper/45">Sign-in</dt>
        <dd>{statusLabel[seat.status]}</dd>
        <dt className="text-charcoal/60 dark:text-warm-paper/45">{labels.seatIdLabel}</dt>
        <dd className="font-mono text-xs break-all pt-0.5">{seat.id}</dd>
      </dl>

      {seat.isReadOnly ? (
        <p className="text-sm px-3 py-3 rounded-[10px] bg-warning/10 border border-warning/40">
          This seat is read-only because the company is over its plan limit. Upgrade to edit it.
        </p>
      ) : seat.status !== 'offboarded' ? (
        <div className="space-y-2">
          {onEditCard ? (
            <Button variant="primary" isFullWidth onClick={() => onEditCard(seat.id)}>
              Edit card in studio
            </Button>
          ) : null}
          {onUpdateStatus ? (
            <Button
              variant="secondary"
              isFullWidth
              aria-label={`Change status for seat ${seat.id}`}
              onClick={async () => {
                const status: SeatItem['status'] = seat.status === 'inactive' ? (seat.personId ? 'active' : 'vacant') : 'inactive';
                await onUpdateStatus(seat.id, status);
              }}
            >
              {seat.status === 'inactive' ? 'Reactivate card' : 'Pause card'}
            </Button>
          ) : null}
          {renderInvite ? (
            renderInvite(seat)
          ) : (
            <p className="flex items-start gap-2 text-[13px] text-charcoal/70 dark:text-warm-paper/55 pt-1">
              <UserPlus className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <span className="font-semibold">{labels.assignPersonTitle}</span> is coming soon. {labels.assignPersonDesc}
              </span>
            </p>
          )}
          {onArchiveSeat ? (
            <Button
              variant="ghost"
              isFullWidth
              onClick={() => setConfirmSeat(seat)}
              data-testid="offboard-seat-button"
              className="text-error dark:text-[#F2A29A] border border-error/30 dark:border-[#F2A29A]/30 hover:bg-error/10"
            >
              Offboard {seat.displayName || 'this seat'}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className={cn('space-y-6 text-charcoal dark:text-warm-paper', className)}>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl md:text-[28px] md:leading-9 font-bold tracking-tight">{labels.title}</h2>
          <p className="text-sm text-charcoal/70 dark:text-warm-paper/60 mt-1">
            {seats.length > 0 ? `${liveSeats.length} ${liveSeats.length === 1 ? 'seat' : 'seats'} · ${live} ${live === 1 ? 'card' : 'cards'} live` : labels.subtitle}
          </p>
        </div>
        {onCreateSeat ? (
          <Button variant="primary" onClick={() => setAddOpen(true)} disabled={atLimit} data-testid="add-seat-button" className="gap-2 self-start sm:self-auto">
            <Plus className="w-4 h-4" aria-hidden="true" />
            {labels.addSeat}
          </Button>
        ) : null}
      </div>

      {isOffline ? (
        <div role="status" aria-live="polite" className="flex items-center gap-3 px-4 py-3 rounded-[10px] border border-warning/40 bg-warning/10 text-sm">
          <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
          {labels.offlineBanner}
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="flex items-center gap-3 px-4 py-3 rounded-[10px] border border-error/40 bg-error/10 text-sm">
          <AlertTriangle className="w-4 h-4 text-error shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : null}

      {hasOverLimitSeats ? (
        <div
          role="region"
          aria-label="Plan limit warning"
          data-testid="over-limit-banner"
          className="flex items-start gap-3 px-4 py-4 rounded-[10px] border border-warning/40 bg-warning/10"
        >
          <Lock className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <div className="text-sm font-bold">
              {labels.overLimitWarningTitle} ({total} of {maxSeats})
            </div>
            <p className="text-sm opacity-80">{labels.overLimitWarningDesc}</p>
          </div>
        </div>
      ) : null}

      {seats.length === 0 ? (
        <EmptyState
          data-testid="seats-empty-state"
          icon={<Users className="w-6 h-6" aria-hidden="true" />}
          title={labels.emptyTitle}
          description={labels.emptyDesc}
          actionLabel={onCreateSeat ? labels.addSeat : undefined}
          onAction={onCreateSeat ? () => setAddOpen(true) : undefined}
        />
      ) : (
        <>
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" aria-hidden="true" />
              <label htmlFor="seats-search" className="sr-only">
                Search people
              </label>
              <Input id="seats-search" type="search" placeholder="Search by name, role or branch" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
            </div>
            <div role="group" aria-label="Filter by card" className="flex flex-wrap gap-0.5 p-[3px] rounded-[10px] bg-sand/40 dark:bg-charcoal border border-sand-border dark:border-white/[0.08] self-start">
              {filterOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilter(opt.value)}
                  aria-pressed={filter === opt.value}
                  className={cn(
                    'min-h-[38px] px-3 rounded-lg text-[13px] font-bold transition-colors',
                    filter === opt.value ? 'bg-warm-paper text-charcoal shadow-sm dark:bg-[#393536] dark:text-warm-paper' : 'opacity-60 hover:opacity-100'
                  )}
                >
                  {opt.label}
                  <span className="ml-1.5 tabular-nums font-semibold opacity-60">{counts[opt.value] || 0}</span>
                </button>
              ))}
            </div>
            {branches.length > 1 ? (
              <div className="lg:ml-auto lg:w-56">
                <label htmlFor="seats-branch" className="sr-only">
                  Branch
                </label>
                <Select
                  id="seats-branch"
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  options={[{ value: '', label: 'All branches' }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
                />
              </div>
            ) : null}
          </div>

          <div className={cn('grid gap-4 items-start', wide && 'lg:grid-cols-[minmax(0,1fr)_340px]')}>
            <div className="rounded-[14px] border border-sand-border dark:border-white/[0.08] bg-warm-paper dark:bg-charcoal overflow-hidden">
              {visible.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm opacity-70">No one matches this search.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="hidden md:table-header-group">
                    <tr className="text-left text-xs font-bold uppercase tracking-[0.06em] text-charcoal/50 dark:text-warm-paper/45">
                      <th scope="col" className="px-5 py-3.5 font-bold">{labels.personAssignedLabel}</th>
                      <th scope="col" className="px-4 py-3.5 font-bold hidden xl:table-cell">Branch</th>
                      <th scope="col" className="px-4 py-3.5 font-bold">{labels.cardBindingTitle}</th>
                      <th scope="col" className="px-4 py-3.5 font-bold text-right">Views</th>
                      <th scope="col" className="px-4 py-3.5 font-bold text-right">Leads</th>
                      <th scope="col" className="px-4 py-3.5"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((seat) => {
                      const isSel = selected?.id === seat.id;
                      return (
                        <tr
                          key={seat.id}
                          data-testid={`seat-card-${seat.id}`}
                          onClick={() => {
                            setSelectedId(seat.id);
                            if (typeof window !== 'undefined' && window.matchMedia && !window.matchMedia('(min-width: 1024px)').matches) setManaged(seat);
                          }}
                          className={cn(
                            'border-t border-sand-border dark:border-white/[0.08] cursor-pointer transition-colors',
                            isSel ? 'bg-bridge-orange/[0.07] shadow-[inset_3px_0_0_#F68713]' : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.03]',
                            seat.isReadOnly && 'opacity-80'
                          )}
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <Avatar name={seat.displayName || ''} />
                              <div className="min-w-0">
                                <div className={cn('font-bold', !seat.displayName && 'opacity-60 font-semibold')}>{nameOf(seat)}</div>
                                <div className="text-[13px] text-charcoal/65 dark:text-warm-paper/55">{seat.title}</div>
                                <div className="md:hidden mt-1.5 flex flex-wrap items-center gap-2">
                                  {cardPill(seat)}
                                  <span className="text-xs opacity-60 tabular-nums">{seat.stats?.views ?? 0} views · {seat.stats?.leads ?? 0} leads</span>
                                </div>
                              </div>
                              {seat.isReadOnly ? (
                                <span data-testid={`readonly-badge-${seat.id}`} className="shrink-0">
                                  <StatusChip status="warning">{labels.readOnlyBadge}</StatusChip>
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 hidden xl:table-cell text-charcoal/65 dark:text-warm-paper/55">{branchOf(seat) || '—'}</td>
                          <td className="px-4 py-3.5 hidden md:table-cell">{cardPill(seat)}</td>
                          <td className="px-4 py-3.5 hidden md:table-cell">
                            <div className="flex items-center justify-end gap-2.5">
                              <Sparkline data={seat.stats?.daily} />
                              <span className="font-bold tabular-nums w-7 text-right">{seat.stats?.views ?? 0}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 hidden md:table-cell text-right font-bold tabular-nums">{seat.stats?.leads ?? 0}</td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(seat.id);
                                setManaged(seat);
                              }}
                              aria-label={`Manage ${nameOf(seat)}, ${seat.title}`}
                              className="w-9 h-9 inline-flex items-center justify-center rounded-[9px] border border-sand-border dark:border-white/10 opacity-70 hover:opacity-100 lg:hidden"
                            >
                              <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
                            </button>
                            {onEditCard && !seat.isReadOnly && seat.status !== 'offboarded' ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditCard(seat.id);
                                }}
                                aria-label={`Edit card for ${nameOf(seat)}`}
                                className="w-9 h-9 hidden lg:inline-flex items-center justify-center rounded-[9px] border border-sand-border dark:border-white/10 opacity-70 hover:opacity-100"
                              >
                                <Pencil className="w-4 h-4" aria-hidden="true" />
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {selected && wide ? (
              <aside aria-label={`Details for ${nameOf(selected)}`} className="sticky top-0 rounded-[14px] border border-sand-border dark:border-white/[0.08] bg-warm-paper dark:bg-charcoal p-5">
                {detail(selected)}
              </aside>
            ) : null}
          </div>
        </>
      )}

      {/* Add seat */}
      <SlideOverPanel
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title={labels.addSeat}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={submitting}>
              {labels.cancel}
            </Button>
            <Button variant="primary" type="submit" form="add-seat-form" isLoading={submitting} data-testid="add-seat-submit">
              {labels.addSeat}
            </Button>
          </>
        }
      >
        <form id="add-seat-form" onSubmit={submitDraft} noValidate className="space-y-4">
          <p className="text-sm text-charcoal/70 dark:text-warm-paper/70">
            The seat gets a draft card straight away. Fill in the person&apos;s details now or later in the card editor.
          </p>
          {(
            [
              { key: 'title', label: 'Job title', required: true, placeholder: 'Head of sales', type: 'text', autoComplete: 'organization-title' },
              { key: 'name', label: 'Full name', placeholder: 'Rohit Deshmukh', type: 'text', autoComplete: 'name' },
              { key: 'phone', label: 'Mobile number', placeholder: '98220 12345', type: 'tel', autoComplete: 'tel', hint: 'Shown on the card for Call and WhatsApp.' },
              { key: 'email', label: 'Email', placeholder: 'rohit@company.com', type: 'email', autoComplete: 'email' },
            ] as const
          ).map((f) => (
            <div key={f.key} className="space-y-1">
              <label htmlFor={`seat-${f.key}`} className="block text-sm font-semibold">
                {f.label}
                {'required' in f && f.required ? <span className="text-error"> *</span> : <span className="font-normal text-charcoal/60 dark:text-warm-paper/60"> (optional)</span>}
              </label>
              <Input
                id={`seat-${f.key}`}
                type={f.type}
                autoComplete={f.autoComplete}
                placeholder={f.placeholder}
                value={(draft[f.key] as string) || ''}
                hasError={Boolean(draftErrors[f.key])}
                aria-invalid={Boolean(draftErrors[f.key]) || undefined}
                aria-describedby={draftErrors[f.key] ? `seat-${f.key}-error` : 'hint' in f ? `seat-${f.key}-hint` : undefined}
                onChange={(e) => {
                  setDraft({ ...draft, [f.key]: e.target.value });
                  if (draftErrors[f.key]) setDraftErrors({ ...draftErrors, [f.key]: '' });
                }}
                onBlur={() => blurField(f.key)}
              />
              {draftErrors[f.key] ? (
                <p id={`seat-${f.key}-error`} className="text-sm text-error">
                  {draftErrors[f.key]}
                </p>
              ) : 'hint' in f ? (
                <p id={`seat-${f.key}-hint`} className="text-xs text-charcoal/60 dark:text-warm-paper/60">
                  {f.hint}
                </p>
              ) : null}
            </div>
          ))}
          {branches.length > 0 ? (
            <div className="space-y-1">
              <label htmlFor="seat-branch" className="block text-sm font-semibold">
                Branch <span className="font-normal text-charcoal/60 dark:text-warm-paper/60">(optional)</span>
              </label>
              <Select
                id="seat-branch"
                value={draft.branchId || ''}
                onChange={(e) => setDraft({ ...draft, branchId: e.target.value })}
                options={[{ value: '', label: 'No branch' }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
              />
            </div>
          ) : null}
          {departments.length > 0 ? (
            <div className="space-y-1">
              <label htmlFor="seat-department" className="block text-sm font-semibold">
                Department <span className="font-normal text-charcoal/60 dark:text-warm-paper/60">(optional)</span>
              </label>
              <Select
                id="seat-department"
                value={draft.departmentId || ''}
                onChange={(e) => setDraft({ ...draft, departmentId: e.target.value })}
                options={[{ value: '', label: 'No department' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
              />
            </div>
          ) : null}
          {teams.length > 0 ? (
            <div className="space-y-1">
              <label htmlFor="seat-team" className="block text-sm font-semibold">
                Team <span className="font-normal text-charcoal/60 dark:text-warm-paper/60">(optional)</span>
              </label>
              <Select
                id="seat-team"
                value={draft.teamId || ''}
                onChange={(e) => setDraft({ ...draft, teamId: e.target.value })}
                options={[{ value: '', label: 'No team' }, ...teams.map((t) => ({ value: t.id, label: t.name }))]}
              />
            </div>
          ) : null}
        </form>
      </SlideOverPanel>

      {/* Manage seat (phones and tablets; wide screens show the detail beside the table) */}
      {!wide ? (
        <SlideOverPanel isOpen={Boolean(managedSeat)} onClose={() => setManaged(null)} title={managedSeat ? nameOf(managedSeat) : ''}>
          {managedSeat ? detail(managedSeat) : null}
        </SlideOverPanel>
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(confirmSeat)}
        onClose={() => setConfirmSeat(null)}
        onConfirm={async () => {
          if (!confirmSeat || !onArchiveSeat) return;
          await onArchiveSeat(confirmSeat.id);
          setConfirmSeat(null);
          setManaged(null);
        }}
        title={`Offboard ${confirmSeat?.displayName || confirmSeat?.title || 'this seat'}?`}
        itemName={confirmSeat ? `${confirmSeat.displayName || labels.noPersonAssigned}, ${confirmSeat.title}` : ''}
        explanation="Their card stops showing their details and points visitors to the company instead. You can't undo this from the dashboard."
        confirmLabel="Offboard"
      />
    </div>
  );
};
