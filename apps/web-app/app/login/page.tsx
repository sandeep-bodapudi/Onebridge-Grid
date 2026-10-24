'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthFlow, AuthStep, AuthFlowLabels } from '../../src/features/auth/AuthFlow';
import { apiClient } from '../../src/api-client';

const labels: AuthFlowLabels = {
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
  wrongCodeError: 'Invalid verification code. Please check and try again.',
  lockedError: 'Account locked',
  lockedDescription: 'Too many failed attempts. Please try again after 15 minutes.',
  expiredError: 'Code expired',
  mfaSetupTitle: 'Set up two-factor authentication',
  mfaSecretLabel: 'Authenticator secret',
  mfaChallengeTitle: 'Two-factor authentication',
  sessionExpiredTitle: 'Session expired',
  sessionExpiredDescription: 'Your session has expired. Please sign in again.',
  reloginButton: 'Sign in again',
  offlineNotice: 'You are currently offline.',
  emptySessionsText: 'No active sessions found.',
};

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<AuthStep>('otp_entry');
  const [currentPhone, setCurrentPhone] = useState('');
  const [mfaTicket, setMfaTicket] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Condition 9: Silent refresh on app load
    apiClient.silentRefresh().then((token) => {
      if (token) {
        router.push('/dashboard');
      }
    });
  }, [router]);

  const handleRequestOtp = async (phone: string, consent: boolean) => {
    if (!consent) {
      setErrorMessage('Consent is required to proceed.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await apiClient.requestOtp(phone);
      setCurrentPhone(phone);
      setStep('otp_verify');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to request OTP';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (code: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.verifyOtp(currentPhone, code);
      if (res.status === 'authenticated') {
        router.push('/dashboard');
      } else if (res.status === 'mfa_required') {
        setMfaTicket(res.mfaTicket);
        setStep('mfa_challenge');
      } else if (res.status === 'mfa_setup_required') {
        setMfaTicket(res.mfaTicket);
        setStep('mfa_setup');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid verification code';
      setErrorMessage(msg);
      setStep('wrong_code');
    } finally {
      setIsLoading(false);
    }
  };

  // Hosted prototype: one tap signs in as the fictional demo owner (fake OTP provider, D-DEMO-HOSTING).
  const demoPhone = process.env.NEXT_PUBLIC_DEMO_PHONE;
  const demoCode = process.env.NEXT_PUBLIC_DEMO_OTP || '123456';
  const handleDemoSignIn = async () => {
    if (!demoPhone) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await apiClient.requestOtp(demoPhone);
      const res = await apiClient.verifyOtp(demoPhone, demoCode);
      if (res.status === 'authenticated') router.push('/dashboard');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not open the demo. Try again in a moment.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyMfa = async (code: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await apiClient.verifyMfa(code, mfaTicket);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid TOTP code';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 md:p-8 bg-sand/30 dark:bg-charcoal-deep text-charcoal dark:text-warm-paper">
      <div className="w-full max-w-4xl">
        {errorMessage && (
          <div
            data-testid="auth-error-banner"
            role="alert"
            className="mb-4 px-4 py-3 rounded-panel bg-error/10 text-sm border border-error/40"
          >
            {errorMessage}
          </div>
        )}
        {demoPhone && step === 'otp_entry' ? (
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-panel border border-sand-border dark:border-sand-border/30 bg-warm-paper dark:bg-charcoal">
            <p className="text-sm">
              <span className="font-bold">Prototype demo.</span> Sign in as the owner of Sahyadri Steel Works, a fictional company.
            </p>
            <button
              type="button"
              onClick={handleDemoSignIn}
              disabled={isLoading}
              data-testid="demo-sign-in"
              className="shrink-0 min-h-[44px] px-4 rounded-control bg-charcoal text-warm-paper dark:bg-warm-paper dark:text-charcoal text-sm font-bold disabled:opacity-50"
            >
              Open the demo company
            </button>
          </div>
        ) : null}
        <AuthFlow
          step={step}
          labels={labels}
          isLoading={isLoading}
          onRequestOtp={handleRequestOtp}
          onVerifyOtp={handleVerifyOtp}
          onVerifyMfa={handleVerifyMfa}
          onResendOtp={() => handleRequestOtp(currentPhone, true)}
          onRelogin={() => setStep('otp_entry')}
        />
      </div>
    </main>
  );
}
