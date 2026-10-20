// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { QrFeature } from './QrFeature';
import { apiClient } from '../../api-client';

describe('QrFeature Component', () => {
  const tenantId = '01JACTENANTA00000000000000';
  const cardId = '01JACCARDA0000000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton then lists short links and QR codes', async () => {
    vi.spyOn(apiClient, 'listCardQrs').mockResolvedValue([
      {
        id: 'qr_1',
        tenantId,
        aggregateVersion: 1,
        targetType: 'card',
        targetId: cardId,
        code: 'dflt1234',
        shortUrl: 'https://1b.co/r/dflt1234',
        source: 'default',
        label: 'Default Card Link',
        destinationUrl: 'https://onebridge.in/p/01JACCARDA0000000000000001',
        isExternal: false,
        status: 'active',
        createdAt: '2026-10-14T00:00:00.000Z',
        updatedAt: '2026-10-14T00:00:00.000Z',
      },
      {
        id: 'qr_2',
        tenantId,
        aggregateVersion: 1,
        targetType: 'card',
        targetId: cardId,
        code: 'expo1234',
        shortUrl: 'https://1b.co/r/expo1234',
        source: 'expo_standee',
        label: 'Expo 2026 Hall 4 Standee',
        destinationUrl: 'https://onebridge.in/p/01JACCARDA0000000000000001?source=expo_standee',
        isExternal: false,
        status: 'active',
        createdAt: '2026-10-14T00:00:00.000Z',
        updatedAt: '2026-10-14T00:00:00.000Z',
      },
    ]);

    render(<QrFeature tenantId={tenantId} cardId={cardId} cardName="Rajesh Sharma" userRole="admin" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Default Card Link')).toBeTruthy();
    expect(screen.getByText('Expo 2026 Hall 4 Standee')).toBeTruthy();
    expect(screen.getAllByText('Download QR').length).toBe(2);
  });

  it('renders empty state when no tags exist', async () => {
    vi.spyOn(apiClient, 'listCardQrs').mockResolvedValue([]);

    render(<QrFeature tenantId={tenantId} cardId={cardId} userRole="admin" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/No QR tags created yet/i)).toBeTruthy();
  });

  it('renders error state on API failure', async () => {
    vi.spyOn(apiClient, 'listCardQrs').mockRejectedValue(new Error('Network connectivity error'));

    render(<QrFeature tenantId={tenantId} cardId={cardId} userRole="admin" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Network connectivity error')).toBeTruthy();
  });

  it('handles creating a new source-tagged QR code', async () => {
    vi.spyOn(apiClient, 'listCardQrs').mockResolvedValue([]);
    const createSpy = vi.spyOn(apiClient, 'createCardQr').mockResolvedValue({
      id: 'qr_new',
      tenantId,
      aggregateVersion: 1,
      targetType: 'card',
      targetId: cardId,
      code: 'news1234',
      shortUrl: 'https://1b.co/r/news1234',
      source: 'newsletter',
      label: 'Monthly Newsletter',
      destinationUrl: 'https://onebridge.in/p/01JACCARDA0000000000000001?source=newsletter',
      isExternal: false,
      status: 'active',
      createdAt: '2026-10-14T00:00:00.000Z',
      updatedAt: '2026-10-14T00:00:00.000Z',
    });

    render(<QrFeature tenantId={tenantId} cardId={cardId} userRole="admin" />);

    await act(async () => {
      await Promise.resolve();
    });

    // Click Add new QR tag button
    const addBtn = screen.getByText('+ Add new QR tag');
    fireEvent.click(addBtn);

    const sourceInput = screen.getByPlaceholderText(/Expo 2026/i);
    fireEvent.change(sourceInput, { target: { value: 'newsletter' } });

    const labelInput = screen.getByPlaceholderText(/Exhibition Hall B/i);
    fireEvent.change(labelInput, { target: { value: 'Monthly Newsletter' } });

    const submitBtn = screen.getByText('Create QR tag');
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(createSpy).toHaveBeenCalledWith(
      tenantId,
      cardId,
      expect.objectContaining({
        source: 'newsletter',
        label: 'Monthly Newsletter',
      })
    );
    expect(screen.getByText('Monthly Newsletter')).toBeTruthy();
  });

  it('triggers asset download URL generation via window.open', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.spyOn(apiClient, 'listCardQrs').mockResolvedValue([
      {
        id: 'qr_desk',
        tenantId,
        aggregateVersion: 1,
        targetType: 'card',
        targetId: cardId,
        code: 'desk1234',
        shortUrl: 'https://1b.co/r/desk1234',
        source: 'desk',
        label: 'Desk Standee',
        destinationUrl: 'https://onebridge.in/p/01JACCARDA0000000000000001',
        isExternal: false,
        status: 'active',
        createdAt: '2026-10-14T00:00:00.000Z',
        updatedAt: '2026-10-14T00:00:00.000Z',
      },
    ]);

    render(<QrFeature tenantId={tenantId} cardId={cardId} userRole="admin" />);

    await act(async () => {
      await Promise.resolve();
    });

    const downloadBtn = screen.getByText('Download QR');
    fireEvent.click(downloadBtn);

    const modalDownloadBtn = screen.getByRole('button', { name: /Download file/i });
    fireEvent.click(modalDownloadBtn);

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining(`/cards/${cardId}/qr/qr_desk.png`),
      '_blank'
    );
  });
});
