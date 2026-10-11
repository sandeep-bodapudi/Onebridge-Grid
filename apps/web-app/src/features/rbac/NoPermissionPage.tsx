import React from 'react';
import { ActionButton, StatusChip } from '@onebridge/ui-kit';

export interface NoPermissionPageLabels {
  title?: string;
  description?: string;
  goBack?: string;
  switchCompany?: string;
  contactAdmin?: string;
  restrictedBadge?: string;
  rolePrefix?: string;
}

export interface NoPermissionPageProps {
  requiredRole?: string;
  otherCompaniesCount?: number;
  onGoBack?: () => void;
  onSwitchCompany?: () => void;
  labels?: NoPermissionPageLabels;
}

export const NoPermissionPage: React.FC<NoPermissionPageProps> = ({
  requiredRole = 'Admin',
  otherCompaniesCount = 0,
  onGoBack,
  onSwitchCompany,
  labels = {}
}) => {
  const title = labels.title || 'Access Restricted';
  const description = labels.description || `You need the ${requiredRole} role or higher to view this section.`;
  const goBackText = labels.goBack || 'Go Back';
  const switchCompanyText = labels.switchCompany || 'Switch Company';
  const contactAdminText = labels.contactAdmin || 'Contact your Company Owner or Administrator if you believe this is an error.';
  const restrictedBadgeText = labels.restrictedBadge || 'Restricted';
  const rolePrefixText = labels.rolePrefix || 'Role: ';

  return (
    <div className="flex min-h-[480px] w-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-12 border border-sand-border bg-warm-paper p-8 text-charcoal shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <StatusChip status="warning">{restrictedBadgeText}</StatusChip>
          {requiredRole && (
            <span className="text-caption text-charcoal/60">
              {rolePrefixText}{requiredRole}
            </span>
          )}
        </div>

        <h1 className="mb-2 text-h2 font-bold text-charcoal">
          {title}
        </h1>

        <p className="mb-6 text-body text-charcoal/80 leading-relaxed">
          {description}
        </p>

        <p className="mb-8 text-caption text-charcoal/60">
          {contactAdminText}
        </p>

        <div className="flex flex-col gap-3">
          {otherCompaniesCount > 0 && onSwitchCompany && (
            <ActionButton
              variant="primary"
              className="min-h-[44px] w-full text-charcoal"
              onClick={onSwitchCompany}
            >
              {switchCompanyText}
            </ActionButton>
          )}

          {onGoBack && (
            <ActionButton
              variant="secondary"
              className="min-h-[44px] w-full"
              onClick={onGoBack}
            >
              {goBackText}
            </ActionButton>
          )}
        </div>
      </div>
    </div>
  );
};
