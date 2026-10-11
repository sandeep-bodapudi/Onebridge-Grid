import React, { useState } from 'react';
import { Role } from '@onebridge/shared';
import { StatusChip } from '@onebridge/ui-kit';

export interface CompanyMembershipItem {
  id: string;
  orgId: string;
  orgName?: string;
  role: Role;
}

export interface CompanySwitcherProps {
  memberships: CompanyMembershipItem[];
  activeTenantId?: string;
  isLoading?: boolean;
  error?: string;
  onSelectCompany: (orgId: string) => void;
  labels?: {
    current?: string;
    selectCompanyPrefix?: string;
  };
}

export const CompanySwitcher: React.FC<CompanySwitcherProps> = ({
  memberships = [],
  activeTenantId,
  isLoading = false,
  error,
  onSelectCompany,
  labels = {}
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <div
        data-testid="company-switcher-loading"
        className="flex min-h-[44px] w-56 animate-pulse items-center gap-2 rounded-12 border border-sand-border bg-sand/30 px-3 py-2"
      >
        <div className="h-4 w-4 rounded-full bg-sand" />
        <div className="h-4 flex-1 rounded bg-sand" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[44px] items-center text-caption text-error">
        {error}
      </div>
    );
  }

  if (memberships.length === 0) {
    return null;
  }

  const activeMembership =
    memberships.find(m => m.orgId === activeTenantId) || memberships[0];

  const selectPrefix = labels.selectCompanyPrefix || 'Select Company: ';

  // Single membership: display non-interactive badge
  if (memberships.length === 1) {
    return (
      <div className="inline-flex min-h-[44px] items-center gap-2 rounded-12 border border-sand-border bg-warm-paper px-3 py-1.5 text-charcoal">
        <span className="text-body font-medium">
          {activeMembership.orgName || activeMembership.orgId}
        </span>
        <StatusChip status="info">{activeMembership.role}</StatusChip>
      </div>
    );
  }

  // Multi-company dropdown
  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`${selectPrefix}${activeMembership.orgName || activeMembership.orgId}`}
        onClick={() => setIsOpen(prev => !prev)}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-12 border border-sand-border bg-warm-paper px-4 py-2 text-charcoal transition-colors hover:bg-sand/30 focus:outline-none focus:ring-2 focus:ring-charcoal"
      >
        <span className="text-body font-semibold">
          {activeMembership.orgName || activeMembership.orgId}
        </span>
        <StatusChip status="info">{activeMembership.role}</StatusChip>
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 z-50 mt-2 w-72 origin-top-left rounded-12 border border-sand-border bg-warm-paper p-1.5 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
        >
          {memberships.map(mem => {
            const isSelected = mem.orgId === activeMembership.orgId;
            return (
              <button
                key={mem.id}
                role="option"
                aria-selected={isSelected}
                aria-label={mem.orgName || mem.orgId}
                onClick={() => {
                  onSelectCompany(mem.orgId);
                  setIsOpen(false);
                }}
                className={`flex min-h-[44px] w-full items-center justify-between rounded-8 px-3 py-2 text-left text-body transition-colors ${
                  isSelected ? 'bg-sand/40 font-semibold' : 'hover:bg-sand/20'
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-charcoal font-medium">
                    {mem.orgName || mem.orgId}
                  </span>
                  <span className="text-caption text-charcoal/60">
                    {mem.role}
                  </span>
                </div>
                {isSelected && (
                  <span className="text-caption font-semibold text-deep-orange">
                    {labels.current || '✓'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
