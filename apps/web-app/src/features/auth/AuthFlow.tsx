import React, { useState } from 'react';
import { ActionButton, ArchCard, OfflineBanner, EmptyState, StatusChip } from '@onebridge/ui-kit';

export type AuthStep =
  | 'otp_entry'
  | 'otp_verify'
  | 'wrong_code'
  | 'locked'
  | 'expired_code'
  | 'mfa_setup'
  | 'mfa_challenge'
  | 'session_expired';

export interface AuthFlowLabels {
  title: string;
  phoneLabel: string;
  phonePlaceholder: string;
  consentLabel: string;
  sendOtpButton: string;
  verifyOtpTitle: string;
  codePlaceholder: string;
  verifyButton: string;
  resendCountdownText: string;
  resendButton: string;
  wrongCodeError: string;
  lockedError: string;
  lockedDescription: string;
  expiredError: string;
  mfaSetupTitle: string;
  mfaSecretLabel: string;
  mfaChallengeTitle: string;
  sessionExpiredTitle: string;
  sessionExpiredDescription: string;
  reloginButton: string;
  offlineNotice: string;
  emptySessionsText: string;
}

export interface AuthFlowProps {
  step?: AuthStep;
  initialStep?: AuthStep;
  labels: AuthFlowLabels;
  isLoading?: boolean;
  isOffline?: boolean;
  onRequestOtp?: (phone: string, consent: boolean) => void;
  onVerifyOtp?: (code: string) => void;
  onVerifyMfa?: (code: string) => void;
  onResendOtp?: () => void;
  onRelogin?: () => void;
}

export const AuthFlow: React.FC<AuthFlowProps> = ({
  step: controlledStep,
  initialStep = 'otp_entry',
  labels,
  isLoading = false,
  isOffline = false,
  onRequestOtp,
  onVerifyOtp,
  onVerifyMfa,
  onResendOtp,
  onRelogin,
}) => {
  const [internalStep, setInternalStep] = useState<AuthStep>(initialStep);
  const step = controlledStep ?? internalStep;
  const setStep = setInternalStep;
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(30);

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) return;
    if (onRequestOtp) {
      onRequestOtp(phone, consent);
    } else {
      setInternalStep('otp_verify');
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (onVerifyOtp) onVerifyOtp(code);
  };

  const handleMfaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onVerifyMfa) onVerifyMfa(code);
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 flex flex-col gap-4">
      {isOffline && (
        <div data-testid="offline-banner">
          <OfflineBanner message={labels.offlineNotice} />
        </div>
      )}

      <ArchCard className="p-6">
        {step === 'otp_entry' && (
          <form onSubmit={handleSendOtp} className="flex flex-col gap-4" data-testid="otp-entry-form">
            <h2 className="text-xl font-extrabold text-charcoal">{labels.title}</h2>
            <div className="flex flex-col gap-1">
              <label htmlFor="phone" className="text-sm font-bold text-charcoal">
                {labels.phoneLabel}
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder={labels.phonePlaceholder}
                required
                className="w-full px-3 py-2 rounded-12 border border-sand-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-orange bg-warm-paper text-charcoal"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-charcoal">
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                className="rounded-12 border-sand-border"
                required
              />
              {labels.consentLabel}
            </label>
            <ActionButton
              type="submit"
              variant="primary"
              disabled={!consent || !phone || isLoading}
              isLoading={isLoading}
            >
              {labels.sendOtpButton}
            </ActionButton>
          </form>
        )}

        {step === 'otp_verify' && (
          <form onSubmit={handleVerify} className="flex flex-col gap-4" data-testid="otp-verify-form">
            <h2 className="text-xl font-extrabold text-charcoal">{labels.verifyOtpTitle}</h2>
            <input
              type="text"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder={labels.codePlaceholder}
              required
              className="w-full text-center tracking-widest text-lg font-bold px-3 py-2 rounded-12 border border-sand-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-orange bg-warm-paper text-charcoal"
            />
            <div className="flex justify-between items-center text-sm text-charcoal">
              <span>{labels.resendCountdownText} ({countdown}s)</span>
              <button
                type="button"
                disabled={countdown > 0}
                onClick={onResendOtp}
                className="text-deep-orange underline disabled:opacity-50 min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2"
              >
                {labels.resendButton}
              </button>
            </div>
            <ActionButton
              type="submit"
              variant="primary"
              disabled={code.length < 6 || isLoading}
              isLoading={isLoading}
            >
              {labels.verifyButton}
            </ActionButton>
          </form>
        )}

        {step === 'wrong_code' && (
          <div className="flex flex-col gap-4" data-testid="wrong-code-state">
            <StatusChip status="error">{labels.wrongCodeError}</StatusChip>
            <ActionButton variant="secondary" onClick={() => setStep('otp_verify')}>
              {labels.verifyButton}
            </ActionButton>
          </div>
        )}

        {step === 'locked' && (
          <div className="flex flex-col gap-4" data-testid="locked-state">
            <StatusChip status="warning">{labels.lockedError}</StatusChip>
            <p className="text-sm text-charcoal">
              {labels.lockedDescription}
            </p>
          </div>
        )}

        {step === 'expired_code' && (
          <div className="flex flex-col gap-4" data-testid="expired-state">
            <StatusChip status="error">{labels.expiredError}</StatusChip>
            <ActionButton variant="primary" onClick={() => setStep('otp_entry')}>
              {labels.resendButton}
            </ActionButton>
          </div>
        )}

        {step === 'mfa_setup' && (
          <form onSubmit={handleMfaSubmit} className="flex flex-col gap-4" data-testid="mfa-setup-form">
            <h2 className="text-xl font-extrabold text-charcoal">{labels.mfaSetupTitle}</h2>
            <div className="p-4 bg-sand rounded-16 flex flex-col items-center gap-2">
              <span className="text-xs text-charcoal font-bold">{labels.mfaSecretLabel}</span>
              <code className="text-sm font-bold tracking-wider text-charcoal-deep">
                JBSWY3DPEHPK3PXP
              </code>
            </div>
            <input
              type="text"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder={labels.codePlaceholder}
              required
              className="w-full text-center tracking-widest text-lg font-bold px-3 py-2 rounded-12 border border-sand-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-orange bg-warm-paper text-charcoal"
            />
            <ActionButton type="submit" variant="primary" disabled={code.length < 6 || isLoading}>
              {labels.verifyButton}
            </ActionButton>
          </form>
        )}

        {step === 'mfa_challenge' && (
          <form onSubmit={handleMfaSubmit} className="flex flex-col gap-4" data-testid="mfa-challenge-form">
            <h2 className="text-xl font-extrabold text-charcoal">{labels.mfaChallengeTitle}</h2>
            <input
              type="text"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder={labels.codePlaceholder}
              required
              className="w-full text-center tracking-widest text-lg font-bold px-3 py-2 rounded-12 border border-sand-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-orange bg-warm-paper text-charcoal"
            />
            <ActionButton type="submit" variant="primary" disabled={code.length < 6 || isLoading}>
              {labels.verifyButton}
            </ActionButton>
          </form>
        )}

        {step === 'session_expired' && (
          <div className="flex flex-col gap-4" data-testid="session-expired-state">
            <EmptyState message={labels.sessionExpiredTitle} />
            <ActionButton variant="primary" onClick={onRelogin || (() => setStep('otp_entry'))}>
              {labels.reloginButton}
            </ActionButton>
          </div>
        )}
      </ArchCard>
    </div>
  );
};
