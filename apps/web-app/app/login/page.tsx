'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthFlow, AuthStep, AuthFlowLabels } from '../../src/features/auth/AuthFlow';
import { apiClient } from '../../src/api-client';

const labels: AuthFlowLabels = {
  title: 'Sign in to OneBridge',
  phoneLabel: 'Mobile Phone Number',
  phonePlaceholder: '+91 98765 43210',
  consentLabel: 'I agree to the Terms of Service & Privacy Policy',
  sendOtpButton: 'Send Verification Code',
  verifyOtpTitle: 'Enter 6-Digit Code',
  codePlaceholder: '123456',
  verifyButton: 'Verify & Continue',
  resendCountdownText: 'Resend code in',
  resendButton: 'Resend OTP',
  wrongCodeError: 'Invalid verification code. Please check and try again.',
  lockedError: 'Account Locked',
  lockedDescription: 'Too many failed attempts. Please try again later.',
  expiredError: 'Code Expired',
  mfaSetupTitle: 'Setup Two-Factor Authentication',
  mfaSecretLabel: 'Authenticator Secret',
  mfaChallengeTitle: 'Two-Factor Authentication',
  sessionExpiredTitle: 'Session Expired',
  sessionExpiredDescription: 'Your session has expired. Please sign in again.',
  reloginButton: 'Sign In Again',
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
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to request OTP');
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
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid verification code');
      setStep('wrong_code');
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
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid TOTP code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ maxWidth: '440px', width: '100%' }}>
        {errorMessage && (
          <div
            data-testid="auth-error-banner"
            style={{
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              backgroundColor: '#FEE2E2',
              color: '#B91C1C',
              borderRadius: '8px',
              fontSize: '14px',
            }}
          >
            {errorMessage}
          </div>
        )}
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
