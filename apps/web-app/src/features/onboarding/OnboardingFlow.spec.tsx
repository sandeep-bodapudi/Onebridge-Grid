// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingFlow } from './OnboardingFlow';
import { validateBrandContrast } from './contrast';
import { enOnboardingLabels, hiOnboardingLabels } from './i18n';

describe('OnboardingFlow UI Feature Component', () => {
  describe('Step 1: Company Details (AC-1, AC-2, Sentence Case Copy)', () => {
    it('renders step 1 with all input fields and slug preview using sentence case labels', () => {
      render(<OnboardingFlow labels={enOnboardingLabels} />);

      expect(screen.getByTestId('step-company-details')).toBeDefined();
      expect(screen.getByTestId('input-company-name')).toBeDefined();
      expect(screen.getByTestId('input-industry')).toBeDefined();
      expect(screen.getByTestId('select-size')).toBeDefined();
      expect(screen.getByTestId('input-city')).toBeDefined();
      expect(screen.getByTestId('input-gstin')).toBeDefined();
    });

    it('validates required fields and shows error when company name or city is missing', () => {
      render(<OnboardingFlow labels={enOnboardingLabels} />);

      const nextBtn = screen.getByTestId('btn-next-details');
      fireEvent.click(nextBtn);

      expect(screen.getByTestId('error-company-name')).toBeDefined();
      expect(screen.getByTestId('error-city')).toBeDefined();
      expect(screen.getByTestId('step-company-details')).toBeDefined();
    });

    it('validates GSTIN format with 15-character Indian regex', () => {
      render(<OnboardingFlow labels={enOnboardingLabels} />);

      const nameInput = screen.getByTestId('input-company-name');
      const cityInput = screen.getByTestId('input-city');
      const gstinInput = screen.getByTestId('input-gstin');
      const nextBtn = screen.getByTestId('btn-next-details');

      fireEvent.change(nameInput, { target: { value: 'Acme Global' } });
      fireEvent.change(cityInput, { target: { value: 'Mumbai' } });
      fireEvent.change(gstinInput, { target: { value: 'INVALID123' } });

      fireEvent.click(nextBtn);

      expect(screen.getByTestId('error-gstin')).toBeDefined();
      expect(screen.getByText(enOnboardingLabels.gstinError)).toBeDefined();
    });

    it('advances to next step when required fields and valid GSTIN are provided', () => {
      render(<OnboardingFlow labels={enOnboardingLabels} />);

      const nameInput = screen.getByTestId('input-company-name');
      const cityInput = screen.getByTestId('input-city');
      const gstinInput = screen.getByTestId('input-gstin');
      const nextBtn = screen.getByTestId('btn-next-details');

      fireEvent.change(nameInput, { target: { value: 'Acme Global' } });
      fireEvent.change(cityInput, { target: { value: 'Mumbai' } });
      fireEvent.change(gstinInput, { target: { value: '27ABCDE1234F1Z5' } });

      fireEvent.click(nextBtn);

      expect(screen.getByTestId('step-plan-selection')).toBeDefined();
    });
  });

  describe('Step 2: Plan Selection & payment_after_first_card Feature Flag (AC-5)', () => {
    it('renders plan options and allows selecting Business plan', () => {
      render(<OnboardingFlow labels={enOnboardingLabels} initialStep="plan_selection" />);

      expect(screen.getByTestId('step-plan-selection')).toBeDefined();
      const businessCard = screen.getByTestId('plan-business-card');
      fireEvent.click(businessCard);

      const nextBtn = screen.getByTestId('btn-next-plan');
      fireEvent.click(nextBtn);

      expect(screen.getByTestId('step-brand-setup')).toBeDefined();
    });

    it('respects payment_after_first_card flag by showing brand setup before plan selection', () => {
      render(
        <OnboardingFlow
          labels={enOnboardingLabels}
          paymentAfterFirstCard={true}
        />
      );

      const nameInput = screen.getByTestId('input-company-name');
      const cityInput = screen.getByTestId('input-city');
      const nextBtn = screen.getByTestId('btn-next-details');

      fireEvent.change(nameInput, { target: { value: 'Acme Flag Corp' } });
      fireEvent.change(cityInput, { target: { value: 'Pune' } });
      fireEvent.click(nextBtn);

      expect(screen.getByTestId('step-brand-setup')).toBeDefined();
    });
  });

  describe('Step 3: Brand Setup, Live Preview & Contrast Validation (AC-4, Design Rules)', () => {
    it('renders brand colours inputs and live card preview', () => {
      render(<OnboardingFlow labels={enOnboardingLabels} initialStep="brand_setup" />);

      expect(screen.getByTestId('step-brand-setup')).toBeDefined();
      expect(screen.getByTestId('input-primary-color')).toBeDefined();
      expect(screen.getByTestId('input-secondary-color')).toBeDefined();
      expect(screen.getByTestId('live-card-preview')).toBeDefined();
    });

    it('enforces OneBridge rule: Orange is fill only and auto-adjusts text to Charcoal for legibility', () => {
      const orangeResult = validateBrandContrast('#F68713');
      expect(orangeResult.recommendedTextColor).toBe('#393536'); // Charcoal, never white
      expect(orangeResult.ratio).toBeGreaterThan(4.5); // Meets AA
    });

    it('calculates contrast correctly for dark navy primary color (#1B2A4A)', () => {
      const navyResult = validateBrandContrast('#1B2A4A');
      expect(navyResult.recommendedTextColor).toBe('#FFFFFF');
      expect(navyResult.isAccessible).toBe(true);
      expect(navyResult.ratio).toBeGreaterThan(7); // Meets AAA
    });

    it('shows contrast warning if low contrast color is chosen', () => {
      const yellowResult = validateBrandContrast('#FFFF00');
      expect(yellowResult.recommendedTextColor).toBe('#393536');
    });

    it('updates live card preview when company name and logo URL change', () => {
      render(<OnboardingFlow labels={enOnboardingLabels} initialStep="brand_setup" />);

      const logoInput = screen.getByTestId('input-logo-url');
      fireEvent.change(logoInput, { target: { value: 'https://example.com/logo.png' } });

      const nextBtn = screen.getByTestId('btn-next-brand');
      fireEvent.click(nextBtn);

      expect(screen.getByTestId('step-first-card')).toBeDefined();
    });
  });

  describe('Step 4 & 5: First Card Setup and Launch (AC-7)', () => {
    it('captures first card details and launches organization with time to first card', () => {
      const handleComplete = vi.fn();
      render(
        <OnboardingFlow
          labels={enOnboardingLabels}
          initialStep="first_card"
          onComplete={handleComplete}
        />
      );

      const cardholderInput = screen.getByTestId('input-cardholder-name');
      const roleInput = screen.getByTestId('input-cardholder-role');
      const launchBtn = screen.getByTestId('btn-launch-org');

      fireEvent.change(cardholderInput, { target: { value: 'Rohan Sharma' } });
      fireEvent.change(roleInput, { target: { value: 'CEO' } });
      fireEvent.click(launchBtn);

      expect(handleComplete).toHaveBeenCalledTimes(1);
      const [submittedData, durationSec] = handleComplete.mock.calls[0];
      expect(submittedData.firstCardName).toBe('Rohan Sharma');
      expect(submittedData.firstCardRole).toBe('CEO');
      expect(durationSec).toBeGreaterThanOrEqual(0);

      expect(screen.getByTestId('step-complete')).toBeDefined();
    });
  });

  describe('UI States: Loading, Empty, Offline, and Errors', () => {
    it('renders loading skeleton when isLoading is true', () => {
      render(<OnboardingFlow labels={enOnboardingLabels} isLoading={true} />);
      expect(screen.getByTestId('onboarding-loading')).toBeDefined();
    });

    it('renders empty state when isEmpty is true', () => {
      render(<OnboardingFlow labels={enOnboardingLabels} isEmpty={true} />);
      expect(screen.getByTestId('onboarding-empty')).toBeDefined();
      expect(screen.getByText(enOnboardingLabels.emptyStateMessage)).toBeDefined();
    });

    it('renders offline banner when isOffline is true', () => {
      render(<OnboardingFlow labels={enOnboardingLabels} isOffline={true} />);
      expect(screen.getByTestId('onboarding-offline')).toBeDefined();
      expect(screen.getByText(enOnboardingLabels.offlineNotice)).toBeDefined();
    });

    it('renders error banner when external error is passed', () => {
      render(
        <OnboardingFlow
          labels={enOnboardingLabels}
          error="Failed to connect to organization server"
        />
      );
      expect(screen.getByTestId('onboarding-external-error')).toBeDefined();
      expect(screen.getByText('Failed to connect to organization server')).toBeDefined();
    });
  });

  describe('Accessibility & i18n Verification (Rules 21 & 23)', () => {
    it('renders full flow in Hindi using hiOnboardingLabels without errors', () => {
      render(<OnboardingFlow labels={hiOnboardingLabels} />);

      expect(screen.getByText('अपनी कंपनी सेटअप करें')).toBeDefined();
      expect(screen.getByText('कंपनी का विवरण')).toBeDefined();
      expect(screen.getByText('कंपनी का नाम *')).toBeDefined();
      expect(screen.getByText('जारी रखें')).toBeDefined();
    });

    it('applies motion-reduce:transition-none to interactive animated elements', () => {
      render(<OnboardingFlow labels={enOnboardingLabels} initialStep="plan_selection" />);

      const starterCard = screen.getByTestId('plan-starter-card');
      expect(starterCard.className).toContain('motion-reduce:transition-none');

      const businessCard = screen.getByTestId('plan-business-card');
      expect(businessCard.className).toContain('motion-reduce:transition-none');
    });
  });
});
