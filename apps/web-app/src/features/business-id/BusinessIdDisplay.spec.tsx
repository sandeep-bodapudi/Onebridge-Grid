// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  BusinessIdDisplay,
  AdminSettingsBusinessIdCard,
  AdminRailFooter,
  PublicProfileBusinessId,
} from './index';

describe('BusinessIdDisplay Feature Component (AC-3)', () => {
  const businessId = 'OB-7KQ2MX';

  beforeEach(() => {
    vi.useFakeTimers();
    // Polyfill navigator.clipboard for jsdom
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders Business ID in admin settings card variant with copy button (AC-3)', () => {
    render(<AdminSettingsBusinessIdCard businessId={businessId} />);

    expect(screen.getByTestId('business-id-settings')).toBeTruthy();
    expect(screen.getByText('OB-7KQ2MX')).toBeTruthy();
    expect(screen.getByTestId('btn-copy-business-id')).toBeTruthy();
  });

  it('renders Business ID in admin left rail footer variant (AC-3)', () => {
    render(<AdminRailFooter businessId={businessId} />);

    expect(screen.getByTestId('business-id-rail')).toBeTruthy();
    expect(screen.getByText('OB-7KQ2MX')).toBeTruthy();
    expect(screen.getByTestId('btn-copy-business-id')).toBeTruthy();
  });

  it('renders Business ID in public profile variant (AC-3)', () => {
    render(<PublicProfileBusinessId businessId={businessId} />);

    expect(screen.getByTestId('business-id-public')).toBeTruthy();
    expect(screen.getByText('OB-7KQ2MX')).toBeTruthy();
    expect(screen.getByTestId('btn-copy-business-id')).toBeTruthy();
  });

  it('copies Business ID to clipboard and shows "Copied!" confirmation (AC-3)', async () => {
    const onCopySpy = vi.fn();
    render(<BusinessIdDisplay businessId={businessId} onCopy={onCopySpy} copyFeedbackDurationMs={1500} />);

    const copyBtn = screen.getByTestId('btn-copy-business-id');
    expect(copyBtn).toBeTruthy();

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('OB-7KQ2MX');
    expect(onCopySpy).toHaveBeenCalledWith('OB-7KQ2MX');
    expect(screen.getByText('Copied!')).toBeTruthy();

    // Advance timer past feedback duration
    act(() => {
      vi.advanceTimersByTime(1600);
    });

    // Reverts to original copy state
    expect(screen.queryByText('Copied!')).toBeNull();
  });

  it('handles loading state properly', () => {
    render(<BusinessIdDisplay businessId={businessId} isLoading />);

    expect(screen.getByTestId('business-id-loading')).toBeTruthy();
    const btn = screen.getByRole('button');
    expect(btn).toHaveProperty('disabled', true);
  });

  it('handles empty state when Business ID is absent', () => {
    render(<BusinessIdDisplay businessId="" isEmpty />);

    expect(screen.getByTestId('business-id-empty')).toBeTruthy();
    expect(screen.getByText(/no business id/i)).toBeTruthy();
  });

  it('handles offline state by displaying offline badge', () => {
    render(<AdminSettingsBusinessIdCard businessId={businessId} isOffline />);

    expect(screen.getByTestId('business-id-offline-indicator')).toBeTruthy();
    expect(screen.getByText('Offline')).toBeTruthy();
  });

  it('renders clean empty state on AdminSettingsBusinessIdCard without synthetic ID fallback', () => {
    render(<AdminSettingsBusinessIdCard businessId="" isEmpty />);

    expect(screen.getByTestId('business-id-empty')).toBeTruthy();
    expect(screen.getByText(/no business id/i)).toBeTruthy();
    expect(screen.queryByTestId('business-id-value')).toBeNull();
  });
});
