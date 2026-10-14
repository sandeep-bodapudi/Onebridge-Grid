// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { SeatsFeature } from './SeatsFeature';
import { apiClient } from '../../api-client';

describe('SeatsFeature Component', () => {
  const tenantId = '01JACTENANTA00000000000000';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state then empty state when no seats exist', async () => {
    vi.spyOn(apiClient, 'listSeats').mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
    vi.spyOn(apiClient, 'listBranches').mockResolvedValue([]);
    vi.spyOn(apiClient, 'listDepartments').mockResolvedValue([]);
    vi.spyOn(apiClient, 'listTeams').mockResolvedValue([]);

    render(<SeatsFeature tenantId={tenantId} plan="starter" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('seats-empty-state')).toBeTruthy();
    expect(screen.getByText('No seats configured yet')).toBeTruthy();
  });

  it('renders seats cards, over-limit read-only banner, and vacant seat', async () => {
    vi.spyOn(apiClient, 'listSeats').mockResolvedValue({
      items: [
        {
          id: 'OB-7KQ2MX-E0001',
          tenantId,
          title: 'Managing Director',
          personId: 'person_vikram',
          status: 'active',
          isReadOnly: false,
          cardBinding: {
            cardId: 'card_1',
            cardUrl: 'https://onebridge.in/c/OB-7KQ2MX-E0001',
            qrCodeUrl: 'https://onebridge.in/qr/OB-7KQ2MX-E0001',
            nfcChipId: 'chip_nfc_001',
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'OB-7KQ2MX-E0002',
          tenantId,
          title: 'Account Executive',
          status: 'vacant',
          isReadOnly: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'OB-7KQ2MX-E0003',
          tenantId,
          title: 'Over Limit Support Lead',
          status: 'active',
          isReadOnly: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      total: 3,
      limit: 50,
      offset: 0,
    });
    vi.spyOn(apiClient, 'listBranches').mockResolvedValue([]);
    vi.spyOn(apiClient, 'listDepartments').mockResolvedValue([]);
    vi.spyOn(apiClient, 'listTeams').mockResolvedValue([]);

    render(<SeatsFeature tenantId={tenantId} plan="starter" maxSeats={2} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('seat-card-OB-7KQ2MX-E0001')).toBeTruthy();
    expect(screen.getByTestId('seat-card-OB-7KQ2MX-E0002')).toBeTruthy();
    expect(screen.getByTestId('seat-card-OB-7KQ2MX-E0003')).toBeTruthy();
    expect(screen.getByTestId('over-limit-banner')).toBeTruthy();
    expect(screen.getByTestId('readonly-badge-OB-7KQ2MX-E0003')).toBeTruthy();
    expect(screen.getByText('Managing Director')).toBeTruthy();
    expect(screen.getByText('Account Executive')).toBeTruthy();
  });
});
