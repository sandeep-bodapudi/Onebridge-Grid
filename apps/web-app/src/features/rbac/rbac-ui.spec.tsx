// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NoPermissionPage } from './NoPermissionPage';
import { CompanySwitcher } from './CompanySwitcher';

describe('RBAC UI Components (Section 6 States)', () => {
  describe('NoPermissionPage', () => {
    it('should render default forbidden message and guidance', () => {
      render(
        <NoPermissionPage 
          requiredRole="Company Admin" 
          onGoBack={() => {}} 
        />
      );

      expect(screen.getByText('Access Restricted')).toBeDefined();
      expect(screen.getByText(/You need the Company Admin role/i)).toBeDefined();
      const backBtn = screen.getByRole('button', { name: /Go Back/i });
      expect(backBtn).toBeDefined();
      // Verify minimum touch target classes
      expect(backBtn.className).toContain('min-h-[44px]');
    });

    it('should respect custom i18n/localized labels prop', () => {
      render(
        <NoPermissionPage 
          requiredRole="Owner"
          labels={{
            title: 'प्रवेश प्रतिबंधित',
            restrictedBadge: 'सीमित',
            rolePrefix: 'भूमिका: ',
            goBack: 'पीछे जाएं'
          }}
          onGoBack={() => {}}
        />
      );

      expect(screen.getByText('प्रवेश प्रतिबंधित')).toBeDefined();
      expect(screen.getByText('सीमित')).toBeDefined();
      expect(screen.getByText(/भूमिका: Owner/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /पीछे जाएं/i })).toBeDefined();
    });

    it('should render switch company CTA if other companies are available', () => {
      const onSwitch = vi.fn();
      render(
        <NoPermissionPage 
          requiredRole="Owner"
          otherCompaniesCount={2}
          onSwitchCompany={onSwitch}
        />
      );

      const switchBtn = screen.getByRole('button', { name: /Switch Company/i });
      expect(switchBtn).toBeDefined();
      fireEvent.click(switchBtn);
      expect(onSwitch).toHaveBeenCalledTimes(1);
    });
  });

  describe('CompanySwitcher', () => {
    const singleMembership = [
      { id: 'm-1', orgId: 'org-1', orgName: 'Acme India Pvt Ltd', role: 'owner' as const }
    ];

    const multiMemberships = [
      { id: 'm-1', orgId: 'org-1', orgName: 'Acme India Pvt Ltd', role: 'owner' as const },
      { id: 'm-2', orgId: 'org-2', orgName: 'Beta Logistics LLP', role: 'branch_manager' as const }
    ];

    it('should return null when memberships array is empty', () => {
      const { container } = render(
        <CompanySwitcher 
          memberships={[]} 
          activeTenantId="" 
          onSelectCompany={() => {}} 
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render clean single company badge when user belongs to only 1 company', () => {
      render(
        <CompanySwitcher 
          memberships={singleMembership} 
          activeTenantId="org-1" 
          onSelectCompany={() => {}} 
        />
      );

      expect(screen.getByText('Acme India Pvt Ltd')).toBeDefined();
      expect(screen.getByText('owner')).toBeDefined();
      // Dropdown toggle is NOT rendered for single company
      expect(screen.queryByRole('button', { name: /Select Company/i })).toBeNull();
    });

    it('should render interactive dropdown and allow switching in multi-company state', () => {
      const onSelect = vi.fn();
      render(
        <CompanySwitcher 
          memberships={multiMemberships} 
          activeTenantId="org-1" 
          onSelectCompany={onSelect} 
        />
      );

      const trigger = screen.getByRole('button', { name: /Acme India Pvt Ltd/i });
      expect(trigger).toBeDefined();
      expect(trigger.className).toContain('min-h-[44px]');

      // Open dropdown
      fireEvent.click(trigger);

      expect(screen.getByText('Beta Logistics LLP')).toBeDefined();
      const betaOption = screen.getByRole('option', { name: /Beta Logistics LLP/i });
      expect(betaOption.className).toContain('min-h-[44px]');

      fireEvent.click(betaOption);
      expect(onSelect).toHaveBeenCalledWith('org-2');
    });

    it('should support custom labels prefix for accessibility', () => {
      render(
        <CompanySwitcher 
          memberships={multiMemberships} 
          activeTenantId="org-1" 
          labels={{ selectCompanyPrefix: 'कंपनी चुनें: ' }}
          onSelectCompany={() => {}} 
        />
      );

      const trigger = screen.getByRole('button', { name: /कंपनी चुनें: Acme India Pvt Ltd/i });
      expect(trigger).toBeDefined();
    });

    it('should render loading skeleton when isLoading is true', () => {
      render(
        <CompanySwitcher 
          memberships={[]} 
          activeTenantId="" 
          isLoading={true} 
          onSelectCompany={() => {}} 
        />
      );

      expect(screen.getByTestId('company-switcher-loading')).toBeDefined();
    });
  });
});
