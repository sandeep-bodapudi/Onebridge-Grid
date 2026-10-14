// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { AuditLogFeature } from './AuditLogFeature';
import { apiClient } from '../../api-client';

describe('AuditLogFeature Component', () => {
  const tenantId = '01JACTENANTA00000000000000';

  const mockAuditResponse = {
    items: [
      {
        id: '01JD2XAUD00000000000000001',
        tenantId,
        actor: '01JD2XPER00000000000000001',
        actorPersonId: '01JD2XPER00000000000000001',
        action: 'branch.created',
        entityType: 'branch',
        entityId: 'BR-001',
        ip: '192.168.1.5',
        before: null,
        after: { name: 'Bengaluru HQ' },
        occurredAt: '2026-10-10T10:00:00.000Z',
      },
    ],
    entries: [
      {
        id: '01JD2XAUD00000000000000001',
        tenantId,
        actor: '01JD2XPER00000000000000001',
        actorPersonId: '01JD2XPER00000000000000001',
        action: 'branch.created',
        entityType: 'branch',
        entityId: 'BR-001',
        ip: '192.168.1.5',
        before: null,
        after: { name: 'Bengaluru HQ' },
        occurredAt: '2026-10-10T10:00:00.000Z',
      },
    ],
    total: 1,
    limit: 50,
    offset: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and displays audit logs for admin role', async () => {
    vi.spyOn(apiClient, 'getAuditLogs').mockResolvedValue(mockAuditResponse);

    render(<AuditLogFeature tenantId={tenantId} userRole="admin" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(apiClient.getAuditLogs).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({ limit: 50, offset: 0 })
    );
    expect(screen.getByText('Audit trail')).toBeTruthy();
    expect(screen.getByText('branch.created')).toBeTruthy();
    expect(screen.getByText('BR-001')).toBeTruthy();
  });

  it('triggers filter query when filter is applied', async () => {
    vi.spyOn(apiClient, 'getAuditLogs').mockResolvedValue(mockAuditResponse);

    render(<AuditLogFeature tenantId={tenantId} userRole="owner" />);

    await act(async () => {
      await Promise.resolve();
    });

    const actionInput = screen.getByLabelText('Action');
    fireEvent.change(actionInput, { target: { value: 'branch.created' } });

    const applyBtn = screen.getByTestId('apply-filters-btn');
    await act(async () => {
      fireEvent.click(applyBtn);
    });

    expect(apiClient.getAuditLogs).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({ action: 'branch.created' })
    );
  });

  it('exports CSV on export button click', async () => {
    vi.spyOn(apiClient, 'getAuditLogs').mockResolvedValue(mockAuditResponse);
    vi.spyOn(apiClient, 'exportAuditLogsCsv').mockResolvedValue('ID,Timestamp\n1,2026-10-10');

    // Mock URL.createObjectURL and URL.revokeObjectURL
    const originalCreate = window.URL.createObjectURL;
    const originalRevoke = window.URL.revokeObjectURL;
    window.URL.createObjectURL = vi.fn(() => 'blob:mock');
    window.URL.revokeObjectURL = vi.fn();

    render(<AuditLogFeature tenantId={tenantId} userRole="admin" />);

    await act(async () => {
      await Promise.resolve();
    });

    const exportBtn = screen.getByTestId('export-csv-btn');
    await act(async () => {
      fireEvent.click(exportBtn);
    });

    expect(apiClient.exportAuditLogsCsv).toHaveBeenCalledWith(tenantId, {});

    window.URL.createObjectURL = originalCreate;
    window.URL.revokeObjectURL = originalRevoke;
  });

  it('denies access to employee role with informative error message', async () => {
    const getLogsSpy = vi.spyOn(apiClient, 'getAuditLogs');

    render(<AuditLogFeature tenantId={tenantId} userRole="employee" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(getLogsSpy).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Access denied: Audit log is restricted to Owner and Admin roles/i)
    ).toBeTruthy();
  });

  it('handles error gracefully when API fails', async () => {
    vi.spyOn(apiClient, 'getAuditLogs').mockRejectedValue(new Error('Network failure'));

    render(<AuditLogFeature tenantId={tenantId} userRole="admin" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Network failure')).toBeTruthy();
  });
});
