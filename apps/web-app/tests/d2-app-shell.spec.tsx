// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppShell } from '@onebridge/ui-kit';
import { AuthFlow, AuthFlowLabels } from '../src/features/auth/AuthFlow';
import { OnboardingFlow } from '../src/features/onboarding/OnboardingFlow';
import { enOnboardingLabels } from '../src/features/onboarding/i18n';

describe('Phase D2: App Shell, Sign In & Onboarding Architecture', () => {
  describe('App Shell Layout & Greeting', () => {
    it('renders desktop left rail and mobile navigation with company switcher, Business ID, and role', () => {
      const onNavigate = vi.fn();
      const navItems = [
        { id: 'overview', label: 'Overview', href: '#overview', isActive: true },
        { id: 'cards', label: 'Cards', href: '#cards' },
        { id: 'seats', label: 'People and seats', href: '#seats' },
        { id: 'structure', label: 'Branches and teams', href: '#structure' },
        { id: 'brand', label: 'Brand kit', href: '#brand' },
        { id: 'audit', label: 'Audit log', href: '#audit' },
      ];

      render(
        <AppShell
          companyName="Bharat Enterprises"
          businessId="OB-7KQ2MX"
          userName="Sandeep Bodapudi"
          userRole="Admin"
          navItems={navItems}
          onNavigate={onNavigate}
          greeting="Good morning"
        >
          <div>Main workspace content</div>
        </AppShell>
      );

      // Greeting uses the person's first name; full name and role sit in the user menu
      expect(screen.getByText('Good morning, Sandeep')).toBeTruthy();
      expect(screen.getByText('Sandeep Bodapudi')).toBeTruthy();
      expect(screen.getByText('Admin')).toBeTruthy();

      // Navigation: every section in the rail, the first four in the mobile bar, the rest under More
      expect(screen.getAllByRole('button', { name: 'Overview' })).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: 'Cards' })).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: 'Audit log' })).toHaveLength(1);
      fireEvent.click(screen.getByRole('button', { name: 'More' }));
      expect(screen.getByRole('dialog', { name: 'More sections' })).toBeTruthy();
      expect(screen.getAllByRole('button', { name: 'Audit log' })).toHaveLength(2);

      // Company switcher & Business ID nameplate
      expect(screen.getAllByText('Bharat Enterprises')).toHaveLength(2);
      expect(screen.getAllByText('OB-7KQ2MX')).toHaveLength(2);
    });

    it('greeting uses person name and never exposes phone number', () => {
      const navItems = [{ id: 'cards', label: 'Cards', href: '#cards' }];

      render(
        <AppShell
          companyName="Acme Corp"
          businessId="OB-123456"
          userName="Priya"
          navItems={navItems}
          greeting="Good morning"
        >
          <div>Body</div>
        </AppShell>
      );

      expect(screen.getByText('Good morning, Priya')).toBeTruthy();
      expect(screen.queryByText(/98765/)).toBeNull();
    });
  });

  describe('Sign In (AuthFlow)', () => {
    const authLabels: AuthFlowLabels = {
      title: 'Sign in to OneBridge',
      phoneLabel: 'Mobile phone number',
      phonePlaceholder: '98765 43210',
      consentLabel: 'I agree to the Terms of Service & Privacy Policy',
      sendOtpButton: 'Send verification code',
      verifyOtpTitle: 'Enter 6-digit code',
      codePlaceholder: '123456',
      verifyButton: 'Verify & continue',
      resendCountdownText: 'Resend code in',
      resendButton: 'Resend code',
      wrongCodeError: 'Invalid code.',
      lockedError: 'Account locked.',
      lockedDescription: 'Try again later.',
      expiredError: 'Code expired.',
      mfaSetupTitle: 'MFA setup',
      mfaSecretLabel: 'Secret',
      mfaChallengeTitle: 'MFA challenge',
      sessionExpiredTitle: 'Session expired',
      sessionExpiredDescription: 'Please sign in.',
      reloginButton: 'Sign in',
      offlineNotice: 'Offline',
      emptySessionsText: 'No sessions',
    };

    it('renders desktop brand panel with Span line and +91 phone prefix', () => {
      render(<AuthFlow labels={authLabels} initialStep="otp_entry" />);

      // Brand panel value proposition
      expect(screen.getByText('Your company-owned digital business identity.')).toBeTruthy();

      // +91 phone prefix
      expect(screen.getByText('+91')).toBeTruthy();
      expect(screen.getByPlaceholderText('98765 43210')).toBeTruthy();
    });

    it('renders 6-box OTP entry on verify step', () => {
      render(<AuthFlow labels={authLabels} initialStep="otp_verify" />);

      expect(screen.getByText('Enter 6-digit code')).toBeTruthy();
      expect(screen.getByLabelText('Digit 1')).toBeTruthy();
      expect(screen.getByLabelText('Digit 6')).toBeTruthy();
    });
  });

  describe('Onboarding Flow Live Card Preview & Stepper', () => {
    it('renders Span progress and PhoneFramePreview live card beside the form', () => {
      render(<OnboardingFlow labels={enOnboardingLabels} initialStep="company_details" />);

      // Stepper progress indicator and divider in live card
      expect(screen.getAllByRole('separator').length).toBeGreaterThanOrEqual(1);

      // PhoneFramePreview
      expect(screen.getByRole('region', { name: 'Live mobile card preview' })).toBeTruthy();

      // Inputting company name updates preview in real time
      const nameInput = screen.getByTestId('input-company-name');
      fireEvent.change(nameInput, { target: { value: 'Horizon Technologies' } });

      expect(screen.getAllByText('Horizon Technologies')).toHaveLength(2); // In form and preview
    });
  });
});
