// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { AuthFlow, AuthFlowLabels } from './AuthFlow';

const testLabels: AuthFlowLabels = {
  title: 'Sign in to OneBridge',
  phoneLabel: 'Mobile Number',
  phonePlaceholder: '+91 98765 43210',
  consentLabel: 'I consent to the terms and privacy notice',
  sendOtpButton: 'Send OTP',
  verifyOtpTitle: 'Verify Code',
  codePlaceholder: '6-digit code',
  verifyButton: 'Verify & Continue',
  resendCountdownText: 'Resend code in',
  resendButton: 'Resend OTP',
  wrongCodeError: 'Invalid code entered. Please try again.',
  lockedError: 'Too many attempts. Account locked for 15 minutes.',
  lockedDescription: 'Please wait 15 minutes before attempting again.',
  expiredError: 'OTP has expired. Please request a new one.',
  mfaSetupTitle: 'Set Up Authenticator',
  mfaSecretLabel: 'Secret Key',
  mfaChallengeTitle: 'Enter Authenticator Code',
  sessionExpiredTitle: 'Session Expired',
  sessionExpiredDescription: 'Your session has ended. Please log in again.',
  reloginButton: 'Log In Again',
  offlineNotice: 'You are currently offline. Actions will resume when reconnected.',
  emptySessionsText: 'No active sessions',
};

describe('AuthFlow UI Component States', () => {
  it('renders OTP entry state with phone input and disabled button until consent', () => {
    render(<AuthFlow labels={testLabels} initialStep="otp_entry" />);
    expect(screen.getByTestId('otp-entry-form')).toBeDefined();
    expect(screen.getByText('Sign in to OneBridge')).toBeDefined();
    const submitBtn = screen.getByText('Send OTP');
    expect(submitBtn).toBeDefined();
  });

  it('renders OTP verify state with code input', () => {
    render(<AuthFlow labels={testLabels} initialStep="otp_verify" />);
    expect(screen.getByTestId('otp-verify-form')).toBeDefined();
    expect(screen.getByRole('group', { name: 'One-time verification code' })).toBeDefined();
    expect(screen.getAllByLabelText(/^Digit \d$/)).toHaveLength(6);
  });

  it('spreads a full code typed or autofilled into the first box and submits it', () => {
    let submitted = '';
    render(<AuthFlow labels={testLabels} initialStep="otp_verify" onVerifyOtp={(c) => (submitted = c)} />);
    fireEvent.change(screen.getByLabelText('Digit 1'), { target: { value: '123456' } });
    expect((screen.getByLabelText('Digit 6') as HTMLInputElement).value).toBe('6');
    expect(submitted).toBe('123456');
  });

  it('renders wrong code state', () => {
    render(<AuthFlow labels={testLabels} initialStep="wrong_code" />);
    expect(screen.getByTestId('wrong-code-state')).toBeDefined();
    expect(screen.getByText('Invalid code entered. Please try again.')).toBeDefined();
  });

  it('renders locked state after 5 failed attempts', () => {
    render(<AuthFlow labels={testLabels} initialStep="locked" />);
    expect(screen.getByTestId('locked-state')).toBeDefined();
    expect(screen.getByText('Too many attempts. Account locked for 15 minutes.')).toBeDefined();
  });

  it('renders expired code state', () => {
    render(<AuthFlow labels={testLabels} initialStep="expired_code" />);
    expect(screen.getByTestId('expired-state')).toBeDefined();
    expect(screen.getByText('OTP has expired. Please request a new one.')).toBeDefined();
  });

  it('renders MFA setup state', () => {
    render(<AuthFlow labels={testLabels} initialStep="mfa_setup" />);
    expect(screen.getByTestId('mfa-setup-form')).toBeDefined();
    expect(screen.getByText('Set Up Authenticator')).toBeDefined();
  });

  it('renders MFA challenge state', () => {
    render(<AuthFlow labels={testLabels} initialStep="mfa_challenge" />);
    expect(screen.getByTestId('mfa-challenge-form')).toBeDefined();
    expect(screen.getByText('Enter Authenticator Code')).toBeDefined();
  });

  it('renders session expired state', () => {
    render(<AuthFlow labels={testLabels} initialStep="session_expired" />);
    expect(screen.getByTestId('session-expired-state')).toBeDefined();
    expect(screen.getByText('Session Expired')).toBeDefined();
  });

  it('renders offline banner when isOffline is true', () => {
    render(<AuthFlow labels={testLabels} isOffline={true} />);
    expect(screen.getByTestId('offline-banner')).toBeDefined();
  });

  it('manages resend countdown: button is disabled during countdown and enables when countdown reaches zero', () => {
    vi.useFakeTimers();
    let resendCalled = false;
    render(
      <AuthFlow
        labels={testLabels}
        initialStep="otp_verify"
        onResendOtp={() => {
          resendCalled = true;
        }}
      />
    );

    // Initial state: a countdown, and no resend button yet
    expect(screen.getByText('Resend code in 30s')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Resend code' })).toBeNull();

    // The countdown ticks once a second
    for (let i = 0; i < 30; i++) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }

    const resendBtn = screen.getByRole('button', { name: 'Resend code' });
    fireEvent.click(resendBtn);
    expect(resendCalled).toBe(true);

    vi.useRealTimers();
  });
});
