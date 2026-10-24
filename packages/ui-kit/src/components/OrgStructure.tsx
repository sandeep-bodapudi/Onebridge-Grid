import React, { useState } from 'react';
import { Archive, Building2, FolderTree, Layers, Lock, Plus, Users, WifiOff } from 'lucide-react';
import { cn } from './ActionButton';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { StatusChip } from './StatusChip';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';
import { SlideOverPanel } from './SlideOverPanel';
import { ConfirmDialog } from './ConfirmDialog';

export interface OrgBranchItem {
  id: string;
  name: string;
  address: {
    line1: string;
    city: string;
    state: string;
    pincode: string;
    [key: string]: unknown;
  };
  contact?: {
    email?: string;
    phone?: string;
  };
  status: 'active' | 'archived';
  archivedAt?: string;
  [key: string]: unknown;
}

export interface OrgDepartmentItem {
  id: string;
  name: string;
  branchId?: string;
  status: 'active' | 'archived';
  archivedAt?: string;
  [key: string]: unknown;
}

export interface OrgTeamItem {
  id: string;
  name: string;
  departmentId: string;
  leadPersonId?: string;
  parentTeamId?: string;
  status?: 'active' | 'archived';
  memberPersonIds?: string[];
  [key: string]: unknown;
}

export interface OrgTreeNode {
  id: string;
  name: string;
  type: string;
  managerPersonId?: string;
  children?: OrgTreeNode[];
}

export interface NewBranchInput {
  name: string;
  address: { line1: string; city: string; state: string; pincode: string };
}

export interface NewDepartmentInput {
  name: string;
  branchId?: string;
}

export interface NewTeamInput {
  name: string;
  departmentId: string;
}

export interface OrgStructureLabels {
  title: string;
  subtitle: string;
  seedDefaults: string;
  addDepartment: string;
  addTeam: string;
  addBranch: string;
  branchLimitReachedTitle: string;
  branchLimitReachedDesc: string;
  upgradePlan: string;
  emptyTitle: string;
  emptyDesc: string;
  createPrimaryBranch: string;
  tabBranches: string;
  tabDepartments: string;
  tabTeams: string;
  tabTree: string;
  offlineBanner: string;
  offlineStatus: string;
  archiveConfirmTitle: string;
  archiveConfirmDesc: string;
  cancel: string;
  confirmArchive: string;
  archiveBranch: string;
  archiveDepartment: string;
  archiveTeam: string;
  starterPlan: string;
}

export const defaultOrgStructureLabelsEn: OrgStructureLabels = {
  title: 'Branches and teams',
  subtitle: 'Where your people work and who they work with. Cards show the branch address for directions.',
  seedDefaults: 'Add default departments',
  addDepartment: 'Add department',
  addTeam: 'Add team',
  addBranch: 'Add branch',
  branchLimitReachedTitle: 'Branch limit reached (1 of 1)',
  branchLimitReachedDesc: 'The Starter plan includes one branch. Upgrade to Business for more branches.',
  upgradePlan: 'Upgrade to Business',
  emptyTitle: 'Set up your first branch',
  emptyDesc: 'Add your head office or main location. Cards use its address for the Directions button.',
  createPrimaryBranch: 'Add your first branch',
  tabBranches: 'Branches',
  tabDepartments: 'Departments',
  tabTeams: 'Teams',
  tabTree: 'Org chart',
  offlineBanner: 'You are currently offline. Viewing cached organization structure.',
  offlineStatus: 'Offline',
  archiveConfirmTitle: 'Archive',
  archiveConfirmDesc: 'It disappears from pickers and new cards. Existing cards, leads and the audit log keep their history.',
  cancel: 'Cancel',
  confirmArchive: 'Archive',
  archiveBranch: 'Archive branch',
  archiveDepartment: 'Archive department',
  archiveTeam: 'Archive team',
  starterPlan: 'Starter plan',
};

export const orgStructureLabelsHi: OrgStructureLabels = {
  title: 'संगठन संरचना',
  subtitle: 'अपनी शाखाओं, विभागों, टीमों और पदानुक्रमित पहुंच का प्रबंधन करें।',
  seedDefaults: 'डिफ़ॉल्ट विभाग जोड़ें',
  addDepartment: 'विभाग जोड़ें',
  addTeam: 'टीम जोड़ें',
  addBranch: 'शाखा जोड़ें',
  branchLimitReachedTitle: 'शाखा सीमा समाप्त (1/1)',
  branchLimitReachedDesc:
    'स्टार्टर प्लान में 1 शाखा शामिल है। असीमित शाखा स्थानों के लिए बिज़नेस प्लान में अपग्रेड करें।',
  upgradePlan: 'बिज़नेस में अपग्रेड करें',
  emptyTitle: 'अपनी पहली शाखा स्थापित करें',
  emptyDesc:
    'आपके व्यवसाय को कार्ड, विभाग और रिपोर्टिंग व्यवस्थित करने के लिए कम से कम एक प्राथमिक कार्यालय की आवश्यकता है।',
  createPrimaryBranch: 'प्राथमिक शाखा बनाएं',
  tabBranches: 'शाखाएं',
  tabDepartments: 'विभाग',
  tabTeams: 'टीमें',
  tabTree: 'संगठन चार्ट',
  offlineBanner: 'आप वर्तमान में ऑफ़लाइन हैं। कैश्ड संगठन संरचना देखी जा रही है।',
  offlineStatus: 'ऑफ़लाइन',
  archiveConfirmTitle: 'संग्रहित करें',
  archiveConfirmDesc:
    'संग्रहित वस्तुएं सार्वजनिक प्रश्नों से छिपी होती हैं। ऐतिहासिक कार्ड, लीड और ऑडिट लॉग सुरक्षित रखे जाते हैं।',
  cancel: 'रद्द करें',
  confirmArchive: 'संग्रहित करें',
  archiveBranch: 'शाखा संग्रहीत करें',
  archiveDepartment: 'विभाग संग्रहीत करें',
  archiveTeam: 'टीम संग्रहीत करें',
  starterPlan: 'स्टार्टर प्लान',
};

export interface OrgStructureProps {
  branches?: OrgBranchItem[];
  departments?: OrgDepartmentItem[];
  teams?: OrgTeamItem[];
  tree?: OrgTreeNode;
  plan?: 'starter' | 'business' | 'enterprise';
  isLoading?: boolean;
  isOffline?: boolean;
  error?: string | null;
  labels?: Partial<OrgStructureLabels>;
  /** Built-in add forms (preferred). */
  onCreateBranch?: (input: NewBranchInput) => Promise<void> | void;
  onCreateDepartment?: (input: NewDepartmentInput) => Promise<void> | void;
  onCreateTeam?: (input: NewTeamInput) => Promise<void> | void;
  /** Legacy triggers for hosts that open their own forms. */
  onAddBranch?: () => void;
  onAddDepartment?: () => void;
  onAddTeam?: () => void;
  onSeedDefaults?: () => void;
  onArchiveBranch?: (branchId: string) => void;
  onArchiveDepartment?: (deptId: string) => void;
  onArchiveTeam?: (teamId: string) => void;
  onUpgradePlan?: () => void;
  onMovePerson?: (personId: string, targetBranchId?: string, targetDepartmentId?: string, targetTeamId?: string) => void;
  className?: string;
}

type FormKind = 'branch' | 'department' | 'team';

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  count?: number;
  action?: React.ReactNode;
}> = ({ icon, title, count, action }) => (
  <div className="flex items-center justify-between gap-3">
    <h3 className="flex items-center gap-2 text-base font-bold">
      <span className="text-charcoal/60 dark:text-warm-paper/60 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>
      {title}
      {count !== undefined ? <span className="text-sm font-semibold text-charcoal/50 dark:text-warm-paper/50 tabular-nums">{count}</span> : null}
    </h3>
    {action}
  </div>
);

const TreeBranch: React.FC<{ node: OrgTreeNode; depth: number }> = ({ node, depth }) => (
  <li>
    <div
      className="flex items-center gap-2 min-h-[36px] text-sm"
      style={{ paddingLeft: depth * 20 }}
      data-testid={depth === 1 ? `tree-node-${node.id}` : depth > 1 ? `tree-node-sub-${node.id}` : undefined}
    >
      {depth > 0 ? (
        <span aria-hidden="true" className="flex items-center w-4 shrink-0">
          <span className="w-1 h-1 bg-charcoal/40 dark:bg-warm-paper/40" />
          <span className="flex-1 h-px bg-charcoal/30 dark:bg-warm-paper/30" />
        </span>
      ) : null}
      <span className={cn(depth === 0 ? 'font-bold' : 'font-semibold')}>{node.name}</span>
      <span className="text-xs text-charcoal/50 dark:text-warm-paper/50">{node.type}</span>
    </div>
    {node.children && node.children.length > 0 ? (
      <ul>
        {node.children.map((child) => (
          <TreeBranch key={child.id} node={child} depth={depth + 1} />
        ))}
      </ul>
    ) : null}
  </li>
);

export const OrgStructure: React.FC<OrgStructureProps> = ({
  branches = [],
  departments = [],
  teams = [],
  tree,
  plan = 'starter',
  isLoading = false,
  isOffline = false,
  error = null,
  labels = defaultOrgStructureLabelsEn,
  onCreateBranch,
  onCreateDepartment,
  onCreateTeam,
  onAddBranch,
  onAddDepartment,
  onAddTeam,
  onSeedDefaults,
  onArchiveBranch,
  onArchiveDepartment,
  onArchiveTeam,
  onUpgradePlan,
  className,
}) => {
  const t: OrgStructureLabels = { ...defaultOrgStructureLabelsEn, ...labels };
  const [form, setForm] = useState<FormKind | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<{ type: FormKind; id: string; name: string } | null>(null);

  const activeBranches = branches.filter((b) => b.status === 'active');
  const activeDepartments = departments.filter((d) => d.status === 'active');
  const activeTeams = teams.filter((tm) => tm.status !== 'archived');
  const isBranchLimitReached = plan === 'starter' && activeBranches.length >= 1;

  const canAdd = {
    branch: Boolean(onCreateBranch || onAddBranch),
    department: Boolean(onCreateDepartment || onAddDepartment),
    team: Boolean(onCreateTeam || onAddTeam),
  };

  const openForm = (kind: FormKind) => {
    const legacy = { branch: onAddBranch, department: onAddDepartment, team: onAddTeam }[kind];
    const builtIn = { branch: onCreateBranch, department: onCreateDepartment, team: onCreateTeam }[kind];
    if (!builtIn && legacy) {
      legacy();
      return;
    }
    setValues(kind === 'team' ? { departmentId: activeDepartments[0]?.id || '' } : {});
    setErrors({});
    setForm(kind);
  };

  const fieldsFor: Record<FormKind, Array<{ key: string; label: string; placeholder?: string; required?: boolean }>> = {
    branch: [
      { key: 'name', label: 'Branch name', placeholder: 'Pune head office', required: true },
      { key: 'line1', label: 'Street address', placeholder: 'Plot 12, Bhosari MIDC', required: true },
      { key: 'city', label: 'City', placeholder: 'Pune', required: true },
      { key: 'state', label: 'State', placeholder: 'Maharashtra', required: true },
      { key: 'pincode', label: 'PIN code', placeholder: '411026', required: true },
    ],
    department: [{ key: 'name', label: 'Department name', placeholder: 'Sales', required: true }],
    team: [{ key: 'name', label: 'Team name', placeholder: 'Dealer sales', required: true }],
  };

  const validate = (kind: FormKind, v: Record<string, string>) => {
    const errs: Record<string, string> = {};
    for (const f of fieldsFor[kind]) {
      if (f.required && !v[f.key]?.trim()) errs[f.key] = `Enter the ${f.label.toLowerCase()}.`;
    }
    if (kind === 'branch' && v.pincode && !/^\d{6}$/.test(v.pincode.trim())) errs.pincode = 'Enter a 6-digit PIN code.';
    if (kind === 'team' && !v.departmentId) errs.departmentId = 'Choose a department for this team.';
    return errs;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const errs = validate(form, values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSubmitting(true);
    try {
      if (form === 'branch') {
        await onCreateBranch?.({
          name: values.name.trim(),
          address: { line1: values.line1.trim(), city: values.city.trim(), state: values.state.trim(), pincode: values.pincode.trim() },
        });
      } else if (form === 'department') {
        await onCreateDepartment?.({ name: values.name.trim(), branchId: values.branchId || undefined });
      } else {
        await onCreateTeam?.({ name: values.name.trim(), departmentId: values.departmentId });
      }
      setForm(null);
    } catch {
      // The host shows the error above the page; keep the form open so nothing typed is lost.
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div data-testid="org-structure-loading" className={cn('space-y-4', className)} aria-busy="true">
        <Skeleton width="40%" height={28} />
        <Skeleton height={88} />
        <Skeleton height={88} />
      </div>
    );
  }

  const isEmpty = branches.length === 0 && departments.length === 0;

  return (
    <div data-testid="org-structure-container" className={cn('space-y-8 text-charcoal dark:text-warm-paper', className)}>
      <div>
        <h2 className="text-2xl md:text-[28px] md:leading-9 font-bold tracking-tight">{t.title}</h2>
        <p className="text-sm text-charcoal/70 dark:text-warm-paper/70 max-w-2xl">{t.subtitle}</p>
      </div>

      {isOffline ? (
        <div
          data-testid="org-structure-offline-banner"
          role="status"
          className="flex items-center gap-3 px-4 py-3 rounded-panel border border-warning/40 bg-warning/10 text-sm"
        >
          <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
          {t.offlineBanner}
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="px-4 py-3 rounded-panel border border-error/40 bg-error/10 text-sm">
          {error}
        </div>
      ) : null}

      {isEmpty ? (
        <EmptyState
          data-testid="empty-org-state"
          icon={<Building2 className="w-6 h-6" aria-hidden="true" />}
          title={t.emptyTitle}
          description={t.emptyDesc}
        />
      ) : null}
      {isEmpty && canAdd.branch ? (
        <div className="-mt-4 flex justify-center">
          <Button data-testid="first-branch-prompt-button" variant="primary" onClick={() => openForm('branch')} className="gap-2">
            <Plus className="w-4 h-4" aria-hidden="true" />
            {t.createPrimaryBranch}
          </Button>
        </div>
      ) : isEmpty ? (
        <span data-testid="first-branch-prompt-button" className="sr-only">
          {t.createPrimaryBranch}
        </span>
      ) : null}

      {!isEmpty ? (
        <>
          {/* Branches */}
          <section className="space-y-3" aria-labelledby="org-branches-heading">
            <SectionHeader
              icon={<Building2 aria-hidden="true" />}
              title={t.tabBranches}
              count={activeBranches.length}
              action={
                canAdd.branch ? (
                  <Button
                    data-testid="add-branch-button"
                    variant="secondary"
                    disabled={isBranchLimitReached}
                    onClick={() => openForm('branch')}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    {t.addBranch}
                  </Button>
                ) : null
              }
            />
            <span id="org-branches-heading" className="sr-only">
              {t.tabBranches}
            </span>
            {isBranchLimitReached ? (
              <div
                data-testid="plan-limit-reached-card"
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-panel border border-sand-border dark:border-sand-border/30 bg-sand/40 dark:bg-charcoal-deep/40"
              >
                <div className="flex items-start gap-3">
                  <Lock className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <div className="text-sm font-bold">{t.branchLimitReachedTitle}</div>
                    <p className="text-sm text-charcoal/70 dark:text-warm-paper/70">{t.branchLimitReachedDesc}</p>
                  </div>
                </div>
                {onUpgradePlan ? (
                  <Button data-testid="upgrade-plan-button" variant="secondary" onClick={onUpgradePlan}>
                    {t.upgradePlan}
                  </Button>
                ) : null}
              </div>
            ) : null}
            {branches.length === 0 ? (
              <p className="text-sm text-charcoal/70 dark:text-warm-paper/70">No branches yet.</p>
            ) : (
              <ul data-testid="branches-list" className="rounded-panel border border-sand-border dark:border-sand-border/30 divide-y divide-sand-border dark:divide-sand-border/30 overflow-hidden">
                {branches.map((b) => (
                  <li
                    key={b.id}
                    data-testid={`branch-card-${b.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 bg-warm-paper dark:bg-charcoal"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold flex items-center gap-2">
                        {b.name}
                        {b.status === 'archived' ? <StatusChip status="archived">Archived</StatusChip> : null}
                      </div>
                      <div className="text-sm text-charcoal/70 dark:text-warm-paper/70">
                        {[b.address?.line1, b.address?.city, b.address?.state, b.address?.pincode].filter(Boolean).join(', ')}
                      </div>
                    </div>
                    {onArchiveBranch && b.status === 'active' ? (
                      <Button
                        variant="ghost"
                        data-testid={`archive-branch-${b.id}`}
                        onClick={() => setArchiveTarget({ type: 'branch', id: b.id, name: b.name })}
                        aria-label={`${t.archiveBranch}: ${b.name}`}
                      >
                        <Archive className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Departments */}
          <section className="space-y-3">
            <SectionHeader
              icon={<Layers aria-hidden="true" />}
              title={t.tabDepartments}
              count={activeDepartments.length}
              action={
                <div className="flex gap-2">
                  {onSeedDefaults && departments.length === 0 ? (
                    <Button data-testid="seed-defaults-button" variant="secondary" onClick={onSeedDefaults}>
                      {t.seedDefaults}
                    </Button>
                  ) : null}
                  {canAdd.department ? (
                    <Button data-testid="add-department-button" variant="secondary" onClick={() => openForm('department')} className="gap-2">
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      {t.addDepartment}
                    </Button>
                  ) : null}
                </div>
              }
            />
            {departments.length === 0 ? (
              <p className="text-sm text-charcoal/70 dark:text-warm-paper/70">
                No departments yet. Add the usual ones (sales, operations, accounts) in one step.
              </p>
            ) : (
              <ul data-testid="departments-list" className="flex flex-wrap gap-2">
                {departments.map((d) => (
                  <li
                    key={d.id}
                    data-testid={`department-card-${d.id}`}
                    className={cn(
                      'flex items-center gap-1 pl-3 pr-1 min-h-[44px] rounded-control border border-sand-border dark:border-sand-border/30 bg-warm-paper dark:bg-charcoal text-sm font-semibold',
                      d.status === 'archived' && 'opacity-60'
                    )}
                  >
                    {d.name}
                    {onArchiveDepartment && d.status === 'active' ? (
                      <button
                        type="button"
                        data-testid={`archive-dept-${d.id}`}
                        onClick={() => setArchiveTarget({ type: 'department', id: d.id, name: d.name })}
                        aria-label={`${t.archiveDepartment}: ${d.name}`}
                        className="w-9 h-9 flex items-center justify-center rounded-control text-charcoal/50 hover:text-charcoal hover:bg-sand dark:text-warm-paper/50 dark:hover:bg-charcoal-deep"
                      >
                        <Archive className="w-4 h-4" aria-hidden="true" />
                      </button>
                    ) : (
                      <span className="w-2" />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Teams */}
          <section className="space-y-3">
            <SectionHeader
              icon={<Users aria-hidden="true" />}
              title={t.tabTeams}
              count={activeTeams.length}
              action={
                canAdd.team ? (
                  <Button
                    data-testid="add-team-button"
                    variant="secondary"
                    onClick={() => openForm('team')}
                    disabled={activeDepartments.length === 0}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    {t.addTeam}
                  </Button>
                ) : null
              }
            />
            {teams.length === 0 ? (
              <p className="text-sm text-charcoal/70 dark:text-warm-paper/70">
                {activeDepartments.length === 0 ? 'Add a department first, then group people into teams.' : 'No teams yet.'}
              </p>
            ) : (
              <ul data-testid="teams-list" className="rounded-panel border border-sand-border dark:border-sand-border/30 divide-y divide-sand-border dark:divide-sand-border/30 overflow-hidden">
                {teams.map((team) => (
                  <li key={team.id} data-testid={`team-card-${team.id}`} className="flex items-center justify-between gap-3 px-4 py-3 bg-warm-paper dark:bg-charcoal">
                    <div className="min-w-0">
                      <div className="text-sm font-bold">{team.name}</div>
                      <div className="text-sm text-charcoal/70 dark:text-warm-paper/70">
                        {departments.find((d) => d.id === team.departmentId)?.name || 'No department'}
                        {team.memberPersonIds?.length ? `, ${team.memberPersonIds.length} people` : ''}
                      </div>
                    </div>
                    {onArchiveTeam && team.status !== 'archived' ? (
                      <Button
                        variant="ghost"
                        data-testid={`archive-team-${team.id}`}
                        onClick={() => setArchiveTarget({ type: 'team', id: team.id, name: team.name })}
                        aria-label={`${t.archiveTeam}: ${team.name}`}
                      >
                        <Archive className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Org chart */}
          {tree && tree.children && tree.children.length > 0 ? (
            <section className="space-y-3">
              <SectionHeader icon={<FolderTree aria-hidden="true" />} title={t.tabTree} />
              <div data-testid="org-chart-tree-view" className="rounded-panel border border-sand-border dark:border-sand-border/30 bg-warm-paper dark:bg-charcoal px-4 py-3 overflow-x-auto">
                <ul>
                  <TreeBranch node={tree} depth={0} />
                </ul>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      <SlideOverPanel
        isOpen={form !== null}
        onClose={() => setForm(null)}
        title={form === 'branch' ? t.addBranch : form === 'department' ? t.addDepartment : t.addTeam}
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)} disabled={submitting}>
              {t.cancel}
            </Button>
            <Button variant="primary" type="submit" form="org-add-form" isLoading={submitting} data-testid="org-add-submit">
              {form === 'branch' ? t.addBranch : form === 'department' ? t.addDepartment : t.addTeam}
            </Button>
          </>
        }
      >
        {form ? (
          <form id="org-add-form" onSubmit={submit} noValidate className="space-y-4">
            {fieldsFor[form].map((f) => (
              <div key={f.key} className="space-y-1">
                <label htmlFor={`org-${f.key}`} className="block text-sm font-semibold">
                  {f.label}
                  {f.required ? <span className="text-error"> *</span> : null}
                </label>
                <Input
                  id={`org-${f.key}`}
                  placeholder={f.placeholder}
                  value={values[f.key] || ''}
                  hasError={Boolean(errors[f.key])}
                  aria-invalid={Boolean(errors[f.key]) || undefined}
                  aria-describedby={errors[f.key] ? `org-${f.key}-error` : undefined}
                  inputMode={f.key === 'pincode' ? 'numeric' : undefined}
                  onChange={(e) => {
                    setValues({ ...values, [f.key]: e.target.value });
                    if (errors[f.key]) setErrors({ ...errors, [f.key]: '' });
                  }}
                  onBlur={() => {
                    const errs = validate(form, values);
                    setErrors((prev) => ({ ...prev, [f.key]: errs[f.key] || '' }));
                  }}
                />
                {errors[f.key] ? (
                  <p id={`org-${f.key}-error`} className="text-sm text-error">
                    {errors[f.key]}
                  </p>
                ) : null}
              </div>
            ))}
            {form === 'department' && activeBranches.length > 0 ? (
              <div className="space-y-1">
                <label htmlFor="org-branchId" className="block text-sm font-semibold">
                  Branch <span className="font-normal text-charcoal/60 dark:text-warm-paper/60">(optional)</span>
                </label>
                <Select
                  id="org-branchId"
                  value={values.branchId || ''}
                  onChange={(e) => setValues({ ...values, branchId: e.target.value })}
                  options={[{ value: '', label: 'All branches' }, ...activeBranches.map((b) => ({ value: b.id, label: b.name }))]}
                />
              </div>
            ) : null}
            {form === 'team' ? (
              <div className="space-y-1">
                <label htmlFor="org-departmentId" className="block text-sm font-semibold">
                  Department <span className="text-error">*</span>
                </label>
                <Select
                  id="org-departmentId"
                  value={values.departmentId || ''}
                  hasError={Boolean(errors.departmentId)}
                  onChange={(e) => setValues({ ...values, departmentId: e.target.value })}
                  options={activeDepartments.map((d) => ({ value: d.id, label: d.name }))}
                />
                {errors.departmentId ? <p className="text-sm text-error">{errors.departmentId}</p> : null}
              </div>
            ) : null}
          </form>
        ) : null}
      </SlideOverPanel>

      <ConfirmDialog
        isOpen={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => {
          if (!archiveTarget) return;
          if (archiveTarget.type === 'branch') onArchiveBranch?.(archiveTarget.id);
          if (archiveTarget.type === 'department') onArchiveDepartment?.(archiveTarget.id);
          if (archiveTarget.type === 'team') onArchiveTeam?.(archiveTarget.id);
          setArchiveTarget(null);
        }}
        title={`${t.archiveConfirmTitle} ${archiveTarget?.name ?? ''}?`}
        itemName={archiveTarget?.name ?? ''}
        explanation={t.archiveConfirmDesc}
        confirmLabel={
          archiveTarget?.type === 'branch' ? t.archiveBranch : archiveTarget?.type === 'department' ? t.archiveDepartment : t.archiveTeam
        }
      />
    </div>
  );
};
