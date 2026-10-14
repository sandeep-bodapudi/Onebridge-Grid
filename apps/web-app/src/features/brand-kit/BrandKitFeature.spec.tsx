// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { BrandKitFeature } from './BrandKitFeature';
import { apiClient } from '../../api-client';

describe('BrandKitFeature Component', () => {
  const tenantId = '01JACTENANTA00000000000000';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton then loads brand kit and field locks', async () => {
    vi.spyOn(apiClient, 'getBrandKit').mockResolvedValue({
      logo: 'https://cdn.example.com/logo.png',
      brandColours: { band: '#1B2A4A', accent: '#F68713', text: '#FFFFFF' },
      coverImage: 'https://cdn.example.com/cover.jpg',
    });
    vi.spyOn(apiClient, 'getFieldLocks').mockResolvedValue({
      lockedFields: ['title', 'departmentId'],
    });

    render(<BrandKitFeature tenantId={tenantId} userRole="admin" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Brand kit and card locks')).toBeTruthy();
    expect(screen.getAllByText('Company logo').length).toBeGreaterThan(0);
    expect(screen.getByText('Brand colours')).toBeTruthy();
    expect(screen.getByText('Live digital card preview')).toBeTruthy();
  });

  it('renders employee view with locked fields notice', async () => {
    vi.spyOn(apiClient, 'getBrandKit').mockResolvedValue({
      logo: undefined,
      brandColours: { band: '#1B2A4A', accent: '#F68713', text: '#FFFFFF' },
      coverImage: undefined,
    });
    vi.spyOn(apiClient, 'getFieldLocks').mockResolvedValue({
      lockedFields: ['title'],
    });

    render(<BrandKitFeature tenantId={tenantId} userRole="employee" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/Some fields are locked by your organization administrator/i)).toBeTruthy();
  });
});
