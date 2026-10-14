// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { OrgStructureFeature } from './OrgStructureFeature';
import { apiClient } from '../../api-client';

describe('OrgStructureFeature Component', () => {
  const tenantId = '01JACTENANTA00000000000000';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state then empty state when no branches or departments exist', async () => {
    vi.spyOn(apiClient, 'listBranches').mockResolvedValue([]);
    vi.spyOn(apiClient, 'listDepartments').mockResolvedValue([]);
    vi.spyOn(apiClient, 'listTeams').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getTree').mockResolvedValue({
      id: tenantId,
      name: 'Acme Corp',
      type: 'company',
      children: [],
    });

    render(<OrgStructureFeature tenantId={tenantId} plan="starter" />);

    // Initially in loading state or loads quickly
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('empty-org-state')).toBeTruthy();
    expect(screen.getByTestId('first-branch-prompt-button')).toBeTruthy();
  });

  it('renders branches, departments, and enforces plan limit on Starter', async () => {
    vi.spyOn(apiClient, 'listBranches').mockResolvedValue([
      {
        id: 'OB-ALPHA1-B01',
        tenantId,
        name: 'Indiranagar Flagship',
        address: { line1: '100 Feet Rd', city: 'Bengaluru', state: 'Karnataka', pincode: '560038' },
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    vi.spyOn(apiClient, 'listDepartments').mockResolvedValue([
      {
        id: 'OB-ALPHA1-D01',
        tenantId,
        name: 'Sales',
        isDefault: true,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    vi.spyOn(apiClient, 'listTeams').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getTree').mockResolvedValue({
      id: tenantId,
      name: 'Acme Corp',
      type: 'company',
      children: [],
    });

    render(<OrgStructureFeature tenantId={tenantId} plan="starter" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('branch-card-OB-ALPHA1-B01')).toBeTruthy();
    expect(screen.getByTestId('plan-limit-reached-card')).toBeTruthy();
  });

  it('calls seedDefaultDepartments when button is clicked', async () => {
    vi.spyOn(apiClient, 'listBranches').mockResolvedValue([
      {
        id: 'OB-ALPHA1-B01',
        tenantId,
        name: 'HQ',
        address: { line1: 'L1', city: 'Delhi', state: 'Delhi', pincode: '110001' },
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    vi.spyOn(apiClient, 'listDepartments').mockResolvedValue([]);
    vi.spyOn(apiClient, 'listTeams').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getTree').mockResolvedValue({
      id: tenantId,
      name: 'Acme Corp',
      type: 'company',
      children: [],
    });
    const seedSpy = vi.spyOn(apiClient, 'seedDefaultDepartments').mockResolvedValue([]);

    render(<OrgStructureFeature tenantId={tenantId} plan="business" />);

    await act(async () => {
      await Promise.resolve();
    });

    const seedBtn = screen.getByTestId('seed-defaults-button');
    expect(seedBtn).toBeTruthy();

    await act(async () => {
      fireEvent.click(seedBtn);
    });

    expect(seedSpy).toHaveBeenCalledWith(tenantId);
  });
});
