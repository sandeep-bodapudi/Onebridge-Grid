import React, { useState } from 'react';
import { cn, ActionButton } from './ActionButton';
import { StatusChip } from './index';

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
  title: 'Organisation structure',
  subtitle: 'Manage your branches, departments, teams, and hierarchical access scopes.',
  seedDefaults: 'Seed default departments',
  addDepartment: 'Add department',
  addTeam: 'Add team',
  addBranch: 'Add branch',
  branchLimitReachedTitle: 'Branch limit reached (1/1)',
  branchLimitReachedDesc:
    'The Starter plan includes 1 branch. Upgrade to Business for unlimited branch locations and regional teams.',
  upgradePlan: 'Upgrade to Business',
  emptyTitle: 'Set up your first branch',
  emptyDesc:
    'Your business needs at least one primary headquarters or office to organise cards, departments, and manager reporting lines.',
  createPrimaryBranch: 'Create primary branch',
  tabBranches: 'Branches',
  tabDepartments: 'Departments',
  tabTeams: 'Teams',
  tabTree: 'Org chart',
  offlineBanner: 'You are currently offline. Viewing cached organization structure.',
  offlineStatus: 'Offline',
  archiveConfirmTitle: 'Archive',
  archiveConfirmDesc:
    'Archived items are hidden from public queries and card selector lists. Historical cards, lead records, and audit logs are safely kept.',
  cancel: 'Cancel',
  confirmArchive: 'Confirm archive',
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
  confirmArchive: 'संग्रह की पुष्टि करें',
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
  labels?: Partial<OrgStructureLabels>;
  onAddBranch?: () => void;
  onAddDepartment?: () => void;
  onAddTeam?: () => void;
  onSeedDefaults?: () => void;
  onArchiveBranch?: (branchId: string) => void;
  onArchiveDepartment?: (deptId: string) => void;
  onArchiveTeam?: (teamId: string) => void;
  onUpgradePlan?: () => void;
  onMovePerson?: (
    personId: string,
    targetBranchId?: string,
    targetDepartmentId?: string,
    targetTeamId?: string
  ) => void;
  className?: string;
}

export const OrgStructure: React.FC<OrgStructureProps> = ({
  branches = [],
  departments = [],
  teams = [],
  tree,
  plan = 'starter',
  isLoading = false,
  isOffline = false,
  labels = defaultOrgStructureLabelsEn,
  onAddBranch,
  onAddDepartment,
  onAddTeam,
  onSeedDefaults,
  onArchiveBranch,
  onArchiveDepartment,
  onArchiveTeam,
  onUpgradePlan,
  onMovePerson,
  className,
}) => {
  const t: OrgStructureLabels = { ...defaultOrgStructureLabelsEn, ...labels };
  const [activeTab, setActiveTab] = useState<'tree' | 'branches' | 'departments' | 'teams'>('branches');
  const [archiveTarget, setArchiveTarget] = useState<{
    type: 'branch' | 'department' | 'team';
    id: string;
    name: string;
  } | null>(null);

  // Starter allows 1 branch; Business allows unlimited
  const activeBranches = branches.filter((b) => b.status === 'active');
  const isBranchLimitReached = plan === 'starter' && activeBranches.length >= 1;

  // Loading State with prefers-reduced-motion support
  if (isLoading) {
    return (
      <div
        data-testid="org-structure-loading"
        className={cn('space-y-24 p-24 animate-pulse motion-reduce:animate-none', className)}
      >
        <div className="h-32 bg-sand/60 dark:bg-charcoal/60 rounded-12 w-1/3" />
        <div className="h-32 bg-sand/40 dark:bg-charcoal/40 rounded-16" />
        <div className="h-32 bg-sand/40 dark:bg-charcoal/40 rounded-16" />
      </div>
    );
  }

  return (
    <div data-testid="org-structure-container" className={cn('space-y-24 p-24', className)}>
      {/* Offline Banner */}
      {isOffline && (
        <div
          data-testid="org-structure-offline-banner"
          role="status"
          className="bg-warning/20 border border-warning text-charcoal px-16 py-12 rounded-12 text-sm font-bold flex items-center justify-between"
        >
          <span>{t.offlineBanner}</span>
          <StatusChip status="warning">{t.offlineStatus}</StatusChip>
        </div>
      )}

      {/* Header and Actions */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-16 border-b border-sand-border pb-16">
        <div>
          <h2 className="text-2xl font-extrabold text-charcoal dark:text-warm-paper">
            {t.title}
          </h2>
          <p className="text-sm text-charcoal/70 dark:text-warm-paper/70 mt-4">
            {t.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-12">
          {onSeedDefaults && departments.length === 0 && (
            <ActionButton
              data-testid="seed-defaults-button"
              variant="secondary"
              onClick={onSeedDefaults}
              className="min-h-[44px]"
            >
              {t.seedDefaults}
            </ActionButton>
          )}
          {onAddDepartment && activeTab === 'departments' && (
            <ActionButton
              data-testid="add-department-button"
              variant="primary"
              onClick={onAddDepartment}
              className="min-h-[44px]"
            >
              {t.addDepartment}
            </ActionButton>
          )}
          {onAddTeam && activeTab === 'teams' && (
            <ActionButton
              data-testid="add-team-button"
              variant="primary"
              onClick={onAddTeam}
              className="min-h-[44px]"
            >
              {t.addTeam}
            </ActionButton>
          )}
          {onAddBranch && activeTab === 'branches' && (
            <ActionButton
              data-testid="add-branch-button"
              variant="primary"
              disabled={isBranchLimitReached}
              onClick={onAddBranch}
              className="min-h-[44px]"
            >
              {t.addBranch}
            </ActionButton>
          )}
        </div>
      </header>

      {/* Plan Limit Reached Banner (AC-5) */}
      {isBranchLimitReached && (
        <aside
          data-testid="plan-limit-reached-card"
          className="bg-sand/30 border-2 border-deep-orange/40 rounded-16 p-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-16"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-8">
              <span className="font-extrabold text-deep-orange">{t.branchLimitReachedTitle}</span>
              <StatusChip status="warning">{t.starterPlan}</StatusChip>
            </div>
            <p className="text-sm text-charcoal/80 dark:text-warm-paper/80">
              {t.branchLimitReachedDesc}
            </p>
          </div>
          {onUpgradePlan && (
            <ActionButton
              data-testid="upgrade-plan-button"
              variant="primary"
              onClick={onUpgradePlan}
              className="min-h-[44px] whitespace-nowrap"
            >
              {t.upgradePlan}
            </ActionButton>
          )}
        </aside>
      )}

      {/* Empty State / First-Branch Prompt (AC-1) */}
      {branches.length === 0 && departments.length === 0 ? (
        <section
          data-testid="empty-org-state"
          className="text-center py-32 px-24 bg-white dark:bg-charcoal rounded-22 border border-sand-border space-y-16"
        >
          <div className="inline-flex p-16 rounded-full bg-sand/60 text-charcoal mb-8">
            <svg className="w-32 h-32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-charcoal dark:text-warm-paper">
            {t.emptyTitle}
          </h3>
          <p className="text-sm text-charcoal/70 dark:text-warm-paper/70 max-w-md mx-auto">
            {t.emptyDesc}
          </p>
          <div className="pt-8">
            <ActionButton
              data-testid="first-branch-prompt-button"
              variant="primary"
              onClick={onAddBranch}
              className="min-h-[44px]"
            >
              {t.createPrimaryBranch}
            </ActionButton>
          </div>
        </section>
      ) : (
        <>
          {/* Navigation Tabs */}
          <nav aria-label="Organization views" className="flex gap-8 border-b border-sand-border pb-4">
            {(
              [
                { id: 'branches', label: t.tabBranches },
                { id: 'departments', label: t.tabDepartments },
                { id: 'teams', label: t.tabTeams },
                { id: 'tree', label: t.tabTree },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                data-testid={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-16 py-8 font-bold text-sm rounded-12 transition-colors motion-reduce:transition-none min-h-[44px]',
                  activeTab === tab.id
                    ? 'bg-bridge-orange text-charcoal'
                    : 'text-charcoal/70 hover:bg-sand/40 dark:text-warm-paper/70'
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* TAB: Branches List (AC-1, AC-4) */}
          {activeTab === 'branches' && (
            <div data-testid="branches-list" className="grid grid-cols-1 md:grid-cols-2 gap-16">
              {branches.map((b) => (
                <article
                  key={b.id}
                  data-testid={`branch-card-${b.id}`}
                  className="p-20 bg-white dark:bg-charcoal rounded-16 border border-sand-border space-y-12"
                >
                  <div className="flex justify-between items-start gap-12">
                    <div>
                      <span className="text-xs font-mono font-bold text-charcoal/50 dark:text-warm-paper/50">
                        {b.id}
                      </span>
                      <h3 className="text-lg font-bold text-charcoal dark:text-warm-paper">{b.name}</h3>
                    </div>
                    <StatusChip status={b.status === 'active' ? 'success' : 'warning'}>
                      {b.status}
                    </StatusChip>
                  </div>

                  <p className="text-sm text-charcoal/80 dark:text-warm-paper/80">
                    {b.address.line1}, {b.address.city}, {b.address.state} - {b.address.pincode}
                  </p>

                  {b.contact && (
                    <div className="text-xs text-charcoal/60 dark:text-warm-paper/60 space-y-2">
                      {b.contact.email && <div>Email: {b.contact.email}</div>}
                      {b.contact.phone && <div>Phone: {b.contact.phone}</div>}
                    </div>
                  )}

                  {b.status === 'active' && onArchiveBranch && (
                    <div className="pt-8 border-t border-sand-border flex justify-end">
                      <button
                        data-testid={`archive-branch-${b.id}`}
                        onClick={() => setArchiveTarget({ type: 'branch', id: b.id, name: b.name })}
                        className="text-xs font-bold text-deep-orange hover:underline min-h-[44px] px-8"
                      >
                        {t.archiveBranch}
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {/* TAB: Departments List (AC-2) */}
          {activeTab === 'departments' && (
            <div data-testid="departments-list" className="grid grid-cols-1 md:grid-cols-3 gap-16">
              {departments.map((d) => (
                <article
                  key={d.id}
                  data-testid={`department-card-${d.id}`}
                  className="p-20 bg-white dark:bg-charcoal rounded-16 border border-sand-border space-y-12"
                >
                  <div className="flex justify-between items-start gap-8">
                    <div>
                      <span className="text-xs font-mono font-bold text-charcoal/50 dark:text-warm-paper/50">
                        {d.id}
                      </span>
                      <h3 className="text-base font-bold text-charcoal dark:text-warm-paper">{d.name}</h3>
                    </div>
                    <StatusChip status={d.status === 'active' ? 'success' : 'warning'}>
                      {d.status}
                    </StatusChip>
                  </div>

                  <div className="text-xs text-charcoal/60 dark:text-warm-paper/60">
                    Scope: {d.branchId ? `Branch (${d.branchId})` : 'Global company'}
                  </div>

                  {d.status === 'active' && onArchiveDepartment && (
                    <div className="pt-8 border-t border-sand-border flex justify-end">
                      <button
                        data-testid={`archive-dept-${d.id}`}
                        onClick={() => setArchiveTarget({ type: 'department', id: d.id, name: d.name })}
                        className="text-xs font-bold text-deep-orange hover:underline min-h-[44px] px-8"
                      >
                        {t.archiveDepartment}
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {/* TAB: Teams List (AC-3) */}
          {activeTab === 'teams' && (
            <div data-testid="teams-list" className="grid grid-cols-1 md:grid-cols-2 gap-16">
              {teams.map((team) => (
                <article
                  key={team.id}
                  data-testid={`team-card-${team.id}`}
                  className="p-20 bg-white dark:bg-charcoal rounded-16 border border-sand-border space-y-8"
                >
                  <div className="flex justify-between items-start gap-8">
                    <h3 className="text-base font-bold text-charcoal dark:text-warm-paper">{team.name}</h3>
                    <StatusChip status={team.status === 'archived' ? 'warning' : 'success'}>
                      {team.status || 'active'}
                    </StatusChip>
                  </div>
                  <div className="text-xs text-charcoal/60 dark:text-warm-paper/60 space-y-2">
                    <div>Department ID: {team.departmentId}</div>
                    {team.leadPersonId && <div>Lead Person ID: {team.leadPersonId}</div>}
                    {team.parentTeamId && <div>Parent Team ID: {team.parentTeamId}</div>}
                    {team.memberPersonIds && team.memberPersonIds.length > 0 && (
                      <div>Members: {team.memberPersonIds.length} person(s)</div>
                    )}
                  </div>
                  {team.status !== 'archived' && onArchiveTeam && (
                    <div className="pt-8 border-t border-sand-border flex justify-end">
                      <button
                        data-testid={`archive-team-${team.id}`}
                        onClick={() => setArchiveTarget({ type: 'team', id: team.id, name: team.name })}
                        className="text-xs font-bold text-deep-orange hover:underline min-h-[44px] px-8"
                      >
                        {t.archiveTeam}
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {/* TAB: Org Chart Tree View with Drag-and-Drop (AC-6) */}
          {activeTab === 'tree' && (
            <section
              data-testid="org-chart-tree-view"
              className="p-24 bg-white dark:bg-charcoal rounded-16 border border-sand-border"
            >
              {tree ? (
                <div className="space-y-16">
                  <div className="p-16 rounded-12 bg-sand/40 border border-sand-border inline-block">
                    <span className="text-xs font-bold uppercase tracking-wider text-charcoal/60">
                      Company root
                    </span>
                    <h3 className="text-lg font-extrabold text-charcoal">{tree.name}</h3>
                  </div>
                  {tree.children && tree.children.length > 0 && (
                    <div className="pl-24 border-l-2 border-bridge-orange space-y-16 mt-16">
                      {tree.children.map((child: OrgTreeNode) => (
                        <div
                          key={child.id}
                          data-testid={`tree-node-${child.id}`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            try {
                              const raw = e.dataTransfer.getData('application/json');
                              if (raw) {
                                const parsed = JSON.parse(raw);
                                if (parsed.personId && onMovePerson) {
                                  const targetBranch = child.type === 'branch' ? child.id : undefined;
                                  const targetDept = child.type === 'department' ? child.id : undefined;
                                  const targetTeam = child.type === 'team' ? child.id : undefined;
                                  onMovePerson(parsed.personId, targetBranch, targetDept, targetTeam);
                                }
                              }
                            } catch {
                              // drop error ignored
                            }
                          }}
                          className="p-16 rounded-12 bg-white dark:bg-charcoal-deep border border-sand-border transition-colors motion-reduce:transition-none hover:border-bridge-orange"
                        >
                          <div className="flex items-center gap-8">
                            <span className="text-xs uppercase font-bold text-deep-orange">{child.type}</span>
                            <span className="font-bold text-charcoal dark:text-warm-paper">{child.name}</span>
                          </div>
                          {child.children && child.children.length > 0 && (
                            <div className="pl-16 border-l border-sand-border mt-8 space-y-8">
                              {child.children.map((sub: OrgTreeNode) => (
                                <div
                                  key={sub.id}
                                  data-testid={`tree-node-sub-${sub.id}`}
                                  draggable={Boolean(sub.managerPersonId || sub.id)}
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData(
                                      'application/json',
                                      JSON.stringify({ personId: sub.managerPersonId || sub.id })
                                    );
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    try {
                                      const raw = e.dataTransfer.getData('application/json');
                                      if (raw) {
                                        const parsed = JSON.parse(raw);
                                        if (parsed.personId && onMovePerson) {
                                          const targetTeam = sub.type === 'team' ? sub.id : undefined;
                                          onMovePerson(parsed.personId, undefined, undefined, targetTeam);
                                        }
                                      }
                                    } catch {
                                      // drop error ignored
                                    }
                                  }}
                                  className="text-sm text-charcoal/80 dark:text-warm-paper/80 p-4 rounded-8 cursor-grab active:cursor-grabbing hover:bg-sand/30"
                                >
                                  • <span className="font-semibold">{sub.name}</span> ({sub.type})
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-charcoal/60">Tree structure not generated yet.</p>
              )}
            </section>
          )}
        </>
      )}

      {/* Archive Confirmation Dialog / Modal */}
      {archiveTarget && (
        <div
          data-testid="archive-confirm-modal"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/60 p-16"
        >
          <div className="bg-white dark:bg-charcoal rounded-22 p-24 max-w-md w-full shadow-2xl space-y-16 border border-sand-border">
            <h3 className="text-lg font-bold text-charcoal dark:text-warm-paper">
              {t.archiveConfirmTitle} {archiveTarget.type}: {archiveTarget.name}?
            </h3>
            <p className="text-sm text-charcoal/70 dark:text-warm-paper/70">
              {t.archiveConfirmDesc}
            </p>
            <div className="flex justify-end gap-12 pt-8">
              <ActionButton
                data-testid="cancel-archive-button"
                variant="ghost"
                onClick={() => setArchiveTarget(null)}
                className="min-h-[44px]"
              >
                {t.cancel}
              </ActionButton>
              <ActionButton
                data-testid="confirm-archive-button"
                variant="secondary"
                onClick={() => {
                  if (archiveTarget.type === 'branch' && onArchiveBranch) {
                    onArchiveBranch(archiveTarget.id);
                  } else if (archiveTarget.type === 'department' && onArchiveDepartment) {
                    onArchiveDepartment(archiveTarget.id);
                  } else if (archiveTarget.type === 'team' && onArchiveTeam) {
                    onArchiveTeam(archiveTarget.id);
                  }
                  setArchiveTarget(null);
                }}
                className="min-h-[44px] bg-error text-white hover:bg-error/90"
              >
                {t.confirmArchive}
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
