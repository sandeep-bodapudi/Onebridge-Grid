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
    vi.spyOn(apiClient, 'listCardSummaries').mockResolvedValue([
      {
        id: 'OB-ALPHA1-E0001',
        seatId: 'OB-ALPHA1-E0001',
        slug: 'acme/ob-alpha1-e0001',
        status: 'published',
        templateId: 'classic-charcoal',
        name: 'Sneha Reddy',
        designation: 'Sales lead',
        publicUrl: 'https://cards.example/c/acme/ob-alpha1-e0001',
        updatedAt: new Date().toISOString(),
      },
    ]);
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

    expect(screen.getByText('Brand kit')).toBeTruthy();
    expect(screen.getAllByText('Company logo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Brand colours').length).toBeGreaterThan(0);
    expect(screen.getByText('Card preview')).toBeTruthy();
    // The preview uses a real card from the company, not placeholder text
    expect(screen.getByTestId('preview-card-name').textContent).toBe('Sneha Reddy');
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
