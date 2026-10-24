import React, { useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, Lock, Plus, Search, UserPlus, Users, WifiOff } from 'lucide-react';
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
  addSeat: 'Add seat',
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
  branches?: Array<{ id: string; name: string }>;
  departments?: Array<{ id: string; name: string }>;
  teams?: Array<{ id: string; name: string }>;
  className?: string;
}

type Filter = 'all' | SeatItem['status'];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

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
  const statusChip = (status: SeatItem['status']) => {
    const variant = status === 'active' ? 'success' : status === 'vacant' || status === 'invited' ? 'info' : status === 'inactive' ? 'warning' : 'archived';
    return <StatusChip status={variant}>{statusLabel[status]}</StatusChip>;
  };
  const cardChip = (seat: SeatItem) => {
    if (!seat.cardStatus) return <span className="text-sm text-charcoal/50 dark:text-warm-paper/50">—</span>;
    if (seat.cardStatus === 'published') return <StatusChip status="published">Published</StatusChip>;
    if (seat.cardStatus === 'pending_approval') return <StatusChip status="info">Waiting for approval</StatusChip>;
    if (seat.cardStatus === 'inactive') return <StatusChip status="archived">Inactive</StatusChip>;
    return <StatusChip status="draft">Draft</StatusChip>;
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: seats.length };
    for (const s of seats) c[s.status] = (c[s.status] || 0) + 1;
    return c;
  }, [seats]);

  const filterOptions: Array<{ value: Filter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'active', label: labels.statusActive },
    { value: 'vacant', label: customLabels?.statusVacant ?? 'Not signed in' },
    { value: 'inactive', label: labels.statusInactive },
    { value: 'offboarded', label: labels.statusOffboarded },
  ];

  const visible = seats.filter((s) => {
    if (filter !== 'all' && s.status !== filter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [s.displayName, s.title, branches.find((b) => b.id === s.branchId)?.name]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  const nameOf = (seat: SeatItem) => seat.displayName?.trim() || labels.noPersonAssigned;
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
        <Skeleton width="40%" height={28} />
        <Skeleton height={44} />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={64} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-6 text-charcoal dark:text-warm-paper', className)}>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">{labels.title}</h2>
          <p className="text-sm text-charcoal/70 dark:text-warm-paper/70 max-w-2xl">{labels.subtitle}</p>
        </div>
        {onCreateSeat ? (
          <Button
            variant="primary"
            onClick={() => setAddOpen(true)}
            disabled={atLimit}
            data-testid="add-seat-button"
            className="gap-2 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            {labels.addSeat}
          </Button>
        ) : null}
      </div>

      {isOffline ? (
        <div role="status" aria-live="polite" className="flex items-center gap-3 px-4 py-3 rounded-panel border border-warning/40 bg-warning/10 text-sm">
          <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
          {labels.offlineBanner}
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="flex items-center gap-3 px-4 py-3 rounded-panel border border-error/40 bg-error/10 text-sm">
          <AlertTriangle className="w-4 h-4 text-error shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : null}

      {hasOverLimitSeats ? (
        <div
          role="region"
          aria-label="Plan limit warning"
          data-testid="over-limit-banner"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-4 rounded-panel border border-warning/40 bg-warning/10"
        >
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <div className="text-sm font-bold">
                {labels.overLimitWarningTitle} ({total} of {maxSeats})
              </div>
              <p className="text-sm text-charcoal/80 dark:text-warm-paper/80">{labels.overLimitWarningDesc}</p>
            </div>
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal/50 dark:text-warm-paper/50" aria-hidden="true" />
              <label htmlFor="seats-search" className="sr-only">
                Search people
              </label>
              <Input
                id="seats-search"
                type="search"
                placeholder="Search by name, title or branch"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div role="group" aria-label="Filter by status" className="flex gap-1 overflow-x-auto pb-1 lg:pb-0">
              {filterOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilter(opt.value)}
                  aria-pressed={filter === opt.value}
                  className={cn(
                    'shrink-0 min-h-[44px] px-3 rounded-control text-sm font-semibold transition-colors',
                    filter === opt.value
                      ? 'bg-charcoal text-warm-paper dark:bg-warm-paper dark:text-charcoal'
                      : 'text-charcoal/70 hover:bg-sand dark:text-warm-paper/70 dark:hover:bg-charcoal'
                  )}
                >
                  {opt.label}
                  <span className="ml-1.5 tabular-nums opacity-70">{counts[opt.value] || 0}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-panel border border-sand-border dark:border-sand-border/30 overflow-hidden">
            <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_140px_120px_96px] gap-4 px-4 py-3 bg-sand/40 dark:bg-charcoal-deep/50 text-xs font-semibold text-charcoal/70 dark:text-warm-paper/70">
              <span>{labels.personAssignedLabel}</span>
              <span>Branch</span>
              <span>{labels.cardBindingTitle}</span>
              <span>Status</span>
              <span className="sr-only">Actions</span>
            </div>
            {visible.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-charcoal/70 dark:text-warm-paper/70">
                No one matches this search.
              </p>
            ) : (
              <ul className="divide-y divide-sand-border dark:divide-sand-border/30">
                {visible.map((seat) => (
                  <li
                    key={seat.id}
                    data-testid={`seat-card-${seat.id}`}
                    className={cn(
                      'grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_140px_120px_96px] items-center gap-x-4 gap-y-2 px-4 py-3 bg-warm-paper dark:bg-charcoal',
                      seat.isReadOnly && 'bg-sand/30 dark:bg-charcoal-deep/40'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        aria-hidden="true"
                        className={cn(
                          'w-10 h-10 shrink-0 rounded-control flex items-center justify-center text-sm font-bold',
                          seat.displayName ? 'bg-charcoal text-warm-paper dark:bg-warm-paper dark:text-charcoal' : 'bg-sand text-charcoal/50 dark:bg-charcoal-deep dark:text-warm-paper/50'
                        )}
                      >
                        {seat.displayName ? initialsOf(seat.displayName) : '—'}
                      </span>
                      <div className="min-w-0">
                        <div className={cn('text-sm font-bold truncate', !seat.displayName && 'text-charcoal/60 dark:text-warm-paper/60 font-semibold')}>
                          {nameOf(seat)}
                        </div>
                        <div className="text-sm text-charcoal/70 dark:text-warm-paper/70 truncate">{seat.title}</div>
                      </div>
                      {seat.isReadOnly ? (
                        <span data-testid={`readonly-badge-${seat.id}`} className="shrink-0">
                          <StatusChip status="warning">{labels.readOnlyBadge}</StatusChip>
                        </span>
                      ) : null}
                    </div>
                    <div className="hidden md:block text-sm text-charcoal/80 dark:text-warm-paper/80 truncate">{branchOf(seat) || '—'}</div>
                    <div className="hidden md:block">{cardChip(seat)}</div>
                    <div className="hidden md:block">{statusChip(seat.status)}</div>
                    <div className="flex justify-end">
                      <Button variant="ghost" onClick={() => setManaged(seat)} aria-label={`Manage ${nameOf(seat)}, ${seat.title}`}>
                        Manage
                      </Button>
                    </div>
                    <div className="md:hidden col-span-2 flex flex-wrap items-center gap-2">
                      {statusChip(seat.status)}
                      {cardChip(seat)}
                      {branchOf(seat) ? <span className="text-xs text-charcoal/60 dark:text-warm-paper/60">{branchOf(seat)}</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
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

      {/* Manage seat */}
      <SlideOverPanel isOpen={Boolean(managed)} onClose={() => setManaged(null)} title={managed ? nameOf(managed) : ''}>
        {managed ? (
          <div className="space-y-6" data-testid="manage-seat-panel">
            <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-3 text-sm">
              <dt className="text-charcoal/60 dark:text-warm-paper/60">Job title</dt>
              <dd className="font-semibold">{managed.title}</dd>
              <dt className="text-charcoal/60 dark:text-warm-paper/60">Branch</dt>
              <dd>{branchOf(managed) || '—'}</dd>
              <dt className="text-charcoal/60 dark:text-warm-paper/60">Status</dt>
              <dd>{statusChip(managed.status)}</dd>
              <dt className="text-charcoal/60 dark:text-warm-paper/60">{labels.cardBindingTitle}</dt>
              <dd className="flex flex-wrap items-center gap-2">
                {cardChip(managed)}
                {managed.cardPublicUrl && managed.cardStatus === 'published' ? (
                  <a
                    href={managed.cardPublicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 min-h-[44px] text-sm font-semibold text-deep-orange underline underline-offset-2"
                  >
                    Open card <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                ) : null}
              </dd>
              <dt className="text-charcoal/60 dark:text-warm-paper/60">{labels.seatIdLabel}</dt>
              <dd className="font-mono text-xs break-all">{managed.id}</dd>
            </dl>

            {managed.isReadOnly ? (
              <p className="text-sm px-3 py-3 rounded-panel bg-warning/10 border border-warning/40">
                This seat is read-only because the company is over its plan limit. Upgrade to edit it.
              </p>
            ) : managed.status !== 'offboarded' ? (
              <div className="space-y-4">
                {onEditCard ? (
                  <Button variant="secondary" isFullWidth onClick={() => { onEditCard(managed.id); setManaged(null); }}>
                    Edit card details
                  </Button>
                ) : null}
                {onUpdateStatus ? (
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold">{managed.status === 'inactive' ? 'Seat is paused' : 'Pause this seat'}</h3>
                    <p className="text-sm text-charcoal/70 dark:text-warm-paper/70">
                      {managed.status === 'inactive'
                        ? 'Visitors see a neutral "card inactive" page. Reactivate to show the card again.'
                        : 'Use this for someone on long leave. Visitors see a neutral "card inactive" page until you reactivate it.'}
                    </p>
                    <Button
                      variant="secondary"
                      aria-label={`Change status for seat ${managed.id}`}
                      onClick={async () => {
                        const status: SeatItem['status'] = managed.status === 'inactive' ? (managed.personId ? 'active' : 'vacant') : 'inactive';
                        await onUpdateStatus(managed.id, status);
                        setManaged({ ...managed, status });
                      }}
                    >
                      {managed.status === 'inactive' ? 'Reactivate seat' : 'Pause seat'}
                    </Button>
                  </div>
                ) : null}
                <div className="flex items-start gap-3 px-3 py-3 rounded-panel border border-dashed border-sand-border dark:border-sand-border/30 text-sm">
                  <UserPlus className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <span className="font-semibold">{labels.assignPersonTitle}</span> is coming soon. {labels.assignPersonDesc}
                  </span>
                </div>
                {onArchiveSeat ? (
                  <div className="pt-4 border-t border-sand-border dark:border-sand-border/30 space-y-2">
                    <h3 className="text-sm font-bold">Offboard</h3>
                    <p className="text-sm text-charcoal/70 dark:text-warm-paper/70">
                      Use this when someone leaves. Their card shows a &quot;has moved on&quot; page; the seat keeps its link, QR codes and leads.
                    </p>
                    <Button variant="destructive" onClick={() => setConfirmSeat(managed)} data-testid="offboard-seat-button">
                      Offboard {managed.displayName || 'this seat'}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </SlideOverPanel>

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
