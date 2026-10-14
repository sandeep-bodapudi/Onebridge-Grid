import React, { useState } from 'react';
import { cn, ActionButton } from './ActionButton';
import { StatusChip } from './index';

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
  createdAt: string;
  updatedAt: string;
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
  title: 'Seats and people',
  subtitle: 'Each digital card and NFC chip is bound to a company-owned seat.',
  addSeat: 'Add seat',
  addVacantSeat: 'Create vacant seat',
  emptyTitle: 'No seats configured yet',
  emptyDesc:
    'Seats belong to the company and hold cards, QR codes, NFC chips, and lead history even when employees change.',
  overLimitWarningTitle: 'Plan seat limit reached',
  overLimitWarningDesc:
    'You have reached your seat limit. Over-limit seats are preserved as read-only. Upgrade plan to create or modify additional seats.',
  offlineBanner: 'You are currently offline. Viewing cached seats and people.',
  assignPerson: 'Assign person',
  reassignPerson: 'Reassign person',
  statusVacant: 'Vacant',
  statusInvited: 'Invited',
  statusActive: 'Active',
  statusInactive: 'Inactive',
  statusOffboarded: 'Offboarded',
  readOnlyBadge: 'Read-only (Plan limit)',
  cardBindingTitle: 'Digital Card & NFC Bindings',
  seatIdLabel: 'Seat ID',
  personAssignedLabel: 'Assigned Person',
  noPersonAssigned: 'No person assigned (Vacant)',
  cancel: 'Cancel',
  save: 'Save assignment',
  assignPersonTitle: 'Assign person to seat',
  assignPersonDesc:
    'Reassigning keeps the card URL, QR code, NFC chip binding, and lead history intact.',
  personIdPlaceholder: 'Enter person ID or name',
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
  assignPerson: 'व्यक्ति असाइन करें',
  reassignPerson: 'व्यक्ति पुनः असाइन करें',
  statusVacant: 'रिक्त',
  statusInvited: 'आमंत्रित',
  statusActive: 'सक्रिय',
  statusInactive: 'निष्क्रिय',
  statusOffboarded: 'ऑफबोर्डेड',
  readOnlyBadge: 'केवल-पढ़ने योग्य (योजना सीमा)',
  cardBindingTitle: 'डिजिटल कार्ड और NFC बाइंडिंग',
  seatIdLabel: 'सीट आईडी',
  personAssignedLabel: 'असाइन किया गया व्यक्ति',
  noPersonAssigned: 'कोई व्यक्ति असाइन नहीं (रिक्त)',
  cancel: 'रद्द करें',
  save: 'असाइनमेंट सहेजें',
  assignPersonTitle: 'सीट पर व्यक्ति असाइन करें',
  assignPersonDesc:
    'पुनः असाइन करने पर भी कार्ड यूआरएल, क्यूआर कोड, एनएफसी चिप बाइंडिंग और लीड इतिहास सुरक्षित रहते हैं।',
  personIdPlaceholder: 'व्यक्ति आईडी या नाम दर्ज करें',
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
  onCreateSeat?: (dto: {
    title: string;
    branchId?: string;
    departmentId?: string;
    teamId?: string;
    personId?: string;
    managerSeatId?: string;
  }) => Promise<void> | void;
  onAssignPerson?: (seatId: string, personId: string) => Promise<void> | void;
  onUpdateStatus?: (seatId: string, status: SeatItem['status']) => Promise<void> | void;
  onArchiveSeat?: (seatId: string) => Promise<void> | void;
  branches?: Array<{ id: string; name: string }>;
  departments?: Array<{ id: string; name: string }>;
  teams?: Array<{ id: string; name: string }>;
  className?: string;
}

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
  onAssignPerson,
  onUpdateStatus,
  onArchiveSeat,
  branches = [],
  departments = [],
  teams = [],
  className,
}) => {
  const labels: SeatsManagementLabels = { ...defaultSeatsLabelsEn, ...customLabels };

  const [activeModalSeat, setActiveModalSeat] = useState<SeatItem | null>(null);
  const [assignPersonInput, setAssignPersonInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const hasOverLimitSeats = seats.some((s) => s.isReadOnly) || total > maxSeats;

  const filteredSeats = filterStatus === 'all'
    ? seats
    : seats.filter((s) => s.status === filterStatus);

  const getStatusChip = (status: SeatItem['status']) => {
    switch (status) {
      case 'active':
        return <StatusChip status="success">{labels.statusActive}</StatusChip>;
      case 'invited':
        return <StatusChip status="info">{labels.statusInvited}</StatusChip>;
      case 'vacant':
        return <StatusChip status="warning">{labels.statusVacant}</StatusChip>;
      case 'inactive':
        return <StatusChip status="error">{labels.statusInactive}</StatusChip>;
      case 'offboarded':
        return (
          <span className="inline-flex items-center px-12 py-4 rounded-12 font-bold text-sm bg-sand dark:bg-charcoal-deep text-charcoal/60 dark:text-warm-paper/60">
            {labels.statusOffboarded}
          </span>
        );
      default:
        return null;
    }
  };

  const handleOpenAssignModal = (seat: SeatItem) => {
    setActiveModalSeat(seat);
    setAssignPersonInput(seat.personId || '');
  };

  const handleCloseModal = () => {
    setActiveModalSeat(null);
    setAssignPersonInput('');
    setIsSubmitting(false);
  };

  const handleConfirmAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalSeat || !assignPersonInput.trim() || !onAssignPerson) return;
    try {
      setIsSubmitting(true);
      await onAssignPerson(activeModalSeat.id, assignPersonInput.trim());
      handleCloseModal();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div
        data-testid="seats-loading"
        className={cn(
          'p-24 space-y-24 bg-warm-paper dark:bg-charcoal min-h-[400px]',
          className
        )}
      >
        <div className="h-32 bg-sand dark:bg-charcoal-deep rounded-12 w-1/3 animate-pulse motion-reduce:animate-none" />
        <div className="h-16 bg-sand dark:bg-charcoal-deep rounded-12 w-1/2 animate-pulse motion-reduce:animate-none" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 pt-16">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-160 rounded-arch border border-sand-border dark:border-charcoal-deep p-24 bg-sand/30 dark:bg-charcoal-deep/30 animate-pulse motion-reduce:animate-none"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'p-24 space-y-24 bg-warm-paper dark:bg-charcoal text-charcoal dark:text-warm-paper min-h-[400px]',
        className
      )}
    >
      {/* Offline Status Banner */}
      {isOffline && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-arch bg-info/10 text-info border border-info/30 p-16 flex items-center justify-between"
        >
          <div className="flex items-center space-x-12">
            <span className="text-xl" aria-hidden="true">📡</span>
            <span className="font-bold text-sm">{labels.offlineBanner}</span>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="rounded-arch bg-error/10 text-error border border-error/30 p-16 flex items-center justify-between"
        >
          <div className="flex items-center space-x-12">
            <span className="text-xl" aria-hidden="true">⚠️</span>
            <span className="font-bold text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Over-Limit Plan Warning Banner */}
      {hasOverLimitSeats && (
        <div
          role="region"
          aria-label="Plan limit warning"
          data-testid="over-limit-banner"
          className="rounded-arch bg-warning/10 border-2 border-warning/40 p-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-16"
        >
          <div className="space-y-4">
            <div className="flex items-center space-x-8">
              <span className="text-xl" aria-hidden="true">🔒</span>
              <h2 className="font-extrabold text-base text-deep-orange">
                {labels.overLimitWarningTitle} ({total}/{maxSeats})
              </h2>
            </div>
            <p className="text-sm text-charcoal/80 dark:text-warm-paper/80 max-w-2xl">
              {labels.overLimitWarningDesc}
            </p>
          </div>
          <ActionButton
            variant="primary"
            className="whitespace-nowrap min-h-[44px]"
            onClick={() => {}}
          >
            {labels.upgradePlan}
          </ActionButton>
        </div>
      )}

      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-16">
        <div>
          <h1 className="text-2xl font-extrabold">{labels.title}</h1>
          <p className="text-sm text-charcoal/70 dark:text-warm-paper/70 mt-4">
            {labels.subtitle}
          </p>
        </div>

        <div className="flex items-center space-x-12">
          {onCreateSeat && (
            <ActionButton
              variant="primary"
              className="min-h-[44px] min-w-[44px]"
              onClick={() =>
                onCreateSeat({
                  title: 'New Seat',
                })
              }
            >
              + {labels.addSeat}
            </ActionButton>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-8 items-center pt-8 border-b border-sand-border dark:border-charcoal-deep pb-12">
        <span className="text-xs font-bold uppercase tracking-wider text-charcoal/60 dark:text-warm-paper/60 mr-8">
          Status:
        </span>
        {['all', 'vacant', 'invited', 'active', 'inactive', 'offboarded'].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilterStatus(status)}
            className={cn(
              'px-12 py-6 rounded-12 text-xs font-bold transition-colors min-h-[36px]',
              filterStatus === status
                ? 'bg-charcoal text-warm-paper dark:bg-warm-paper dark:text-charcoal'
                : 'bg-sand dark:bg-charcoal-deep text-charcoal/70 dark:text-warm-paper/70 hover:bg-sand-border'
            )}
          >
            {status === 'all'
              ? 'All Seats'
              : labels[`status${status.charAt(0).toUpperCase() + status.slice(1)}` as keyof SeatsManagementLabels] || status}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {seats.length === 0 && (
        <div
          data-testid="seats-empty-state"
          className="rounded-arch border-2 border-dashed border-sand-border dark:border-charcoal-deep p-48 text-center space-y-16"
        >
          <div className="text-4xl" aria-hidden="true">🪑</div>
          <h2 className="text-xl font-bold">{labels.emptyTitle}</h2>
          <p className="text-sm text-charcoal/70 dark:text-warm-paper/70 max-w-md mx-auto">
            {labels.emptyDesc}
          </p>
          {onCreateSeat && (
            <ActionButton
              variant="primary"
              className="mt-16 min-h-[44px]"
              onClick={() =>
                onCreateSeat({
                  title: 'Founder / Managing Director',
                })
              }
            >
              {labels.addSeat}
            </ActionButton>
          )}
        </div>
      )}

      {/* Seats Cards Grid */}
      {seats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
          {filteredSeats.map((seat) => {
            const branchName = branches.find((b) => b.id === seat.branchId)?.name;
            const deptName = departments.find((d) => d.id === seat.departmentId)?.name;
            const teamName = teams.find((t) => t.id === seat.teamId)?.name;

            return (
              <div
                key={seat.id}
                data-testid={`seat-card-${seat.id}`}
                className={cn(
                  'rounded-arch border p-20 space-y-16 transition-shadow shadow-sm',
                  seat.isReadOnly
                    ? 'border-warning/50 bg-sand/30 dark:bg-charcoal-deep/30'
                    : 'border-sand-border dark:border-charcoal-deep bg-white dark:bg-charcoal-deep/50'
                )}
              >
                {/* Seat Header: ID + Title + Status */}
                <div className="flex items-start justify-between gap-12">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-8">
                      <span className="font-mono text-xs font-bold px-8 py-2 rounded-8 bg-sand dark:bg-charcoal-deep text-charcoal dark:text-warm-paper">
                        {seat.id}
                      </span>
                      {seat.isReadOnly && (
                        <span
                          data-testid={`readonly-badge-${seat.id}`}
                          className="px-8 py-2 rounded-8 text-xs font-bold bg-warning/20 text-deep-orange"
                        >
                          {labels.readOnlyBadge}
                        </span>
                      )}
                    </div>
                    <h2 className="font-extrabold text-lg leading-snug">{seat.title}</h2>
                  </div>
                  <div>{getStatusChip(seat.status)}</div>
                </div>

                {/* Organization Hierarchy metadata */}
                {(branchName || deptName || teamName) && (
                  <div className="text-xs text-charcoal/70 dark:text-warm-paper/70 flex flex-wrap gap-x-12 gap-y-4">
                    {branchName && <span>🏢 {branchName}</span>}
                    {deptName && <span>📁 {deptName}</span>}
                    {teamName && <span>👥 {teamName}</span>}
                  </div>
                )}

                {/* Person Assignment Details */}
                <div className="p-12 rounded-12 bg-sand/40 dark:bg-charcoal-deep/70 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-charcoal/60 dark:text-warm-paper/60 uppercase">
                      {labels.personAssignedLabel}
                    </div>
                    <div className="text-sm font-extrabold mt-2">
                      {seat.personId ? (
                        <span className="text-charcoal dark:text-warm-paper">
                          👤 {seat.personId}
                        </span>
                      ) : (
                        <span className="text-deep-orange italic">
                          {labels.noPersonAssigned}
                        </span>
                      )}
                    </div>
                  </div>

                  {!seat.isReadOnly && onAssignPerson && (
                    <ActionButton
                      variant="ghost"
                      className="text-xs font-bold px-12 py-6 min-h-[44px]"
                      onClick={() => handleOpenAssignModal(seat)}
                    >
                      {seat.personId ? labels.reassignPerson : labels.assignPerson}
                    </ActionButton>
                  )}
                </div>

                {/* Digital Card & NFC Binding Information */}
                {seat.cardBinding && (
                  <div className="border-t border-sand-border dark:border-charcoal-deep pt-12 text-xs space-y-4 text-charcoal/80 dark:text-warm-paper/80">
                    <div className="font-bold text-charcoal/60 dark:text-warm-paper/60 uppercase">
                      {labels.cardBindingTitle}
                    </div>
                    <div className="grid grid-cols-2 gap-8 pt-2">
                      {seat.cardBinding.cardUrl && (
                        <div>
                          <span className="font-bold">Card: </span>
                          <span className="font-mono truncate block" title={seat.cardBinding.cardUrl}>
                            {seat.cardBinding.cardUrl}
                          </span>
                        </div>
                      )}
                      {seat.cardBinding.nfcChipId && (
                        <div>
                          <span className="font-bold">NFC: </span>
                          <span className="font-mono">{seat.cardBinding.nfcChipId}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions / Read-only notice */}
                {seat.isReadOnly ? (
                  <div className="text-xs font-semibold text-deep-orange pt-4">
                    ⚠️ Seat is read-only because organization exceeds plan limits. Upgrade to edit.
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-8 border-t border-sand-border dark:border-charcoal-deep">
                    <div className="flex items-center space-x-8">
                      {onUpdateStatus && seat.status !== 'offboarded' && (
                        <select
                          aria-label={`Change status for seat ${seat.id}`}
                          value={seat.status}
                          onChange={(e) =>
                            onUpdateStatus(seat.id, e.target.value as SeatItem['status'])
                          }
                          className="text-xs font-bold rounded-8 border border-sand-border dark:border-charcoal-deep bg-sand/30 dark:bg-charcoal px-8 py-6 min-h-[44px]"
                        >
                          <option value="vacant">{labels.statusVacant}</option>
                          <option value="invited">{labels.statusInvited}</option>
                          <option value="active">{labels.statusActive}</option>
                          <option value="inactive">{labels.statusInactive}</option>
                        </select>
                      )}
                    </div>

                    {onArchiveSeat && seat.status !== 'offboarded' && (
                      <button
                        type="button"
                        onClick={() => onArchiveSeat(seat.id)}
                        className="text-xs font-bold text-error hover:underline px-8 py-6 min-h-[44px]"
                      >
                        Offboard / Archive
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Accessible Assign/Reassign Person Modal Dialog */}
      {activeModalSeat && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-assign-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-16 bg-charcoal/60 backdrop-blur-sm"
        >
          <div className="bg-warm-paper dark:bg-charcoal rounded-arch border border-sand-border dark:border-charcoal-deep max-w-lg w-full p-24 space-y-20 shadow-xl">
            <div className="space-y-4">
              <h2 id="modal-assign-title" className="text-xl font-extrabold">
                {labels.assignPersonTitle}
              </h2>
              <p className="text-sm text-charcoal/70 dark:text-warm-paper/70">
                {labels.assignPersonDesc}
              </p>
            </div>

            <div className="p-12 rounded-12 bg-sand/50 dark:bg-charcoal-deep text-xs space-y-4">
              <div>
                <span className="font-bold">Seat ID:</span> {activeModalSeat.id}
              </div>
              <div>
                <span className="font-bold">Title:</span> {activeModalSeat.title}
              </div>
              {activeModalSeat.personId && (
                <div>
                  <span className="font-bold">Current Person:</span> {activeModalSeat.personId}
                </div>
              )}
            </div>

            <form onSubmit={handleConfirmAssignment} className="space-y-16">
              <div className="space-y-8">
                <label
                  htmlFor="personIdInput"
                  className="block text-sm font-bold text-charcoal dark:text-warm-paper"
                >
                  Person ID or Username
                </label>
                <input
                  id="personIdInput"
                  type="text"
                  required
                  value={assignPersonInput}
                  onChange={(e) => setAssignPersonInput(e.target.value)}
                  placeholder={labels.personIdPlaceholder}
                  className="w-full rounded-12 border border-sand-border dark:border-charcoal-deep px-16 py-12 bg-white dark:bg-charcoal text-sm min-h-[44px] focus:outline focus:outline-2 focus:outline-bridge-orange"
                />
              </div>

              <div className="flex items-center justify-end space-x-12 pt-8">
                <ActionButton
                  type="button"
                  variant="ghost"
                  className="min-h-[44px]"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                >
                  {labels.cancel}
                </ActionButton>
                <ActionButton
                  type="submit"
                  variant="primary"
                  className="min-h-[44px]"
                  isLoading={isSubmitting}
                >
                  {labels.save}
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
