// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { AccessRequestsPanel, RequestAccessForm } from './AccessRequests';
import { apiClient } from '../../api-client';

const TENANT = '01JACTENANTA00000000000000';
const request = {
  id: 'r1',
  status: 'pending' as const,
  requester: { type: 'member' as const, id: 'p1', name: 'Imran (purchase team)', verified: false },
  message: 'I run purchasing at Balanagar.',
  createdAt: '2026-10-27T09:00:00.000Z',
};

describe('N02 access requests', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('lets the owner approve as admin and removes the request', async () => {
    vi.spyOn(apiClient, 'listAccessRequests').mockResolvedValue([request]);
    const decide = vi.spyOn(apiClient, 'decideAccessRequest').mockResolvedValue({ ...request, status: 'approved' });
    render(<AccessRequestsPanel tenantId={TENANT} />);

    expect(await screen.findByText('1 person asked to join')).toBeTruthy();
    expect(screen.getByText('“I run purchasing at Balanagar.”')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Role for Imran (purchase team)'), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(decide).toHaveBeenCalledWith(TENANT, 'r1', 'approve', 'admin'));
    await waitFor(() => expect(screen.queryByTestId('access-requests')).toBeNull());
  });

  it('renders nothing without requests', async () => {
    vi.spyOn(apiClient, 'listAccessRequests').mockResolvedValue([]);
    const { container } = render(<AccessRequestsPanel tenantId={TENANT} />);
    await waitFor(() => expect(apiClient.listAccessRequests).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });

  it('sends a request with the chosen name and confirms without revealing whether the company exists', async () => {
    const send = vi.spyOn(apiClient, 'requestCompanyAccess').mockResolvedValue({ status: 'sent', detail: '' });
    const { container } = render(<RequestAccessForm gstin="36AABCS1429B1Z5" suggestedName="Imran Khan" onBack={() => undefined} />);
    expect((await axe(container)).violations).toEqual([]);
    fireEvent.change(screen.getByLabelText(/Message/), { target: { value: 'Purchasing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask for access' }));
    await waitFor(() => expect(send).toHaveBeenCalledWith({ gstin: '36AABCS1429B1Z5', name: 'Imran Khan', message: 'Purchasing' }));
    expect((await screen.findByTestId('access-request-sent')).textContent).toContain('If this company is on OneBridge Grid');
  });

  it('needs a name', async () => {
    const send = vi.spyOn(apiClient, 'requestCompanyAccess');
    render(<RequestAccessForm gstin="36AABCS1429B1Z5" onBack={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask for access' }));
    expect(screen.getByRole('alert').textContent).toContain('name');
    expect(send).not.toHaveBeenCalled();
  });
});
