import React, { useState } from 'react';
import {
  Button,
  OfflineBanner,
  EmptyState,
  StatusChip,
  SpanLine,
  KeystoneTag,
  Input,
  OtpInput,
  SpanMark,
} from '@onebridge/ui-kit';

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
    <div className="w-full max-w-4xl mx-auto flex flex-col md:flex-row items-stretch rounded-sheet overflow-hidden border border-sand-border dark:border-sand-border/30 bg-warm-paper dark:bg-charcoal shadow-overlay">
      {/* Desktop Brand Panel */}
      <div className="hidden md:flex md:w-5/12 bg-charcoal text-warm-paper p-8 flex-col justify-between border-r border-sand-border/20">
        <div>
          <div className="flex items-center gap-2 mb-6">
            <SpanMark />
            <span className="font-bold text-base tracking-tight text-warm-paper">
              OneBridge Grid
            </span>
          </div>

          <h2 className="font-body text-xl font-bold tracking-tight text-warm-paper leading-snug">
            Your company-owned digital business identity.
          </h2>

          <SpanLine animating className="my-6 opacity-70" />

          {/* Sample Mini Card Preview */}
          <div className="p-4 rounded-panel bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-warm-paper/70">
                OB-DEMO01
              </span>
              <KeystoneTag label="Verified" />
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-bold text-warm-paper">Rohan Sharma</div>
              <div className="text-xs text-warm-paper/70">Managing director, Acme Infra</div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-white/10 text-xs text-warm-paper/60">
          The company owns the identity, cards, and leads. Employees are custodians.
        </div>
      </div>

      {/* Main Interactive Auth Form Area */}
      <div className="w-full md:w-7/12 p-6 md:p-10 flex flex-col justify-center">
        {isOffline && (
          <div data-testid="offline-banner" className="mb-4">
            <OfflineBanner message={labels.offlineNotice} />
          </div>
        )}

        {step === 'otp_entry' && (
          <form onSubmit={handleSendOtp} className="flex flex-col gap-5" data-testid="otp-entry-form">
            <div>
              <h2 className="font-body text-xl font-bold text-charcoal dark:text-warm-paper tracking-tight">
                {labels.title}
              </h2>
              <p className="text-xs text-charcoal/70 dark:text-warm-paper/70 mt-1">
                Enter your mobile phone number to receive a secure one-time code.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="phone" className="text-xs font-bold text-charcoal dark:text-warm-paper">
                {labels.phoneLabel}
              </label>

              {/* Formatted phone field with +91 prefix */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center min-h-[44px] px-3 font-mono text-sm font-bold bg-sand/60 dark:bg-charcoal-deep border border-sand-border dark:border-sand-border/30 rounded-control text-charcoal dark:text-warm-paper select-none">
                  +91
                </span>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={labels.phonePlaceholder}
                  required
                  className="flex-1"
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-charcoal/80 dark:text-warm-paper/80 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 rounded-control border-sand-border focus:ring-bridge-orange"
                required
              />
              <span>{labels.consentLabel}</span>
            </label>

            <Button
              type="submit"
              variant="primary"
              disabled={!consent || !phone || isLoading}
              isLoading={isLoading}
              isFullWidth
            >
              {labels.sendOtpButton}
            </Button>
          </form>
        )}

        {step === 'otp_verify' && (
          <form onSubmit={handleVerify} className="flex flex-col gap-5" data-testid="otp-verify-form">
            <div>
              <h2 className="font-body text-xl font-bold text-charcoal dark:text-warm-paper tracking-tight">
                {labels.verifyOtpTitle}
              </h2>
              <p className="text-xs text-charcoal/70 dark:text-warm-paper/70 mt-1">
                Enter the 6-digit verification code sent to your number.
              </p>
            </div>

            <OtpInput
              value={code}
              onChange={setCode}
              onComplete={(full) => onVerifyOtp?.(full)}
              resendSeconds={30}
              onResend={onResendOtp}
              onChangeNumber={() => {
                setCode('');
                setStep('otp_entry');
              }}
              disabled={isLoading}
            />

            <Button
              type="submit"
              variant="primary"
              disabled={code.length < 6 || isLoading}
              isLoading={isLoading}
              isFullWidth
            >
              {labels.verifyButton}
            </Button>
          </form>
        )}

        {step === 'wrong_code' && (
          <div className="flex flex-col gap-4 text-center" data-testid="wrong-code-state">
            <StatusChip status="error">{labels.wrongCodeError}</StatusChip>
            <p className="text-xs text-charcoal/70 dark:text-warm-paper/70">
              The verification code you entered is incorrect.
            </p>
            <Button variant="secondary" onClick={() => setStep('otp_verify')} isFullWidth>
              {labels.verifyButton}
            </Button>
          </div>
        )}

        {step === 'locked' && (
          <div className="flex flex-col gap-4 text-center" data-testid="locked-state">
            <StatusChip status="warning">{labels.lockedError}</StatusChip>
            <p className="text-xs text-charcoal/70 dark:text-warm-paper/70 leading-relaxed">
              {labels.lockedDescription}
            </p>
          </div>
        )}

        {step === 'expired_code' && (
          <div className="flex flex-col gap-4 text-center" data-testid="expired-state">
            <StatusChip status="error">{labels.expiredError}</StatusChip>
            <p className="text-xs text-charcoal/70 dark:text-warm-paper/70">
              Your one-time password has expired.
            </p>
            <Button variant="primary" onClick={() => setStep('otp_entry')} isFullWidth>
              {labels.resendButton}
            </Button>
          </div>
        )}

        {step === 'mfa_setup' && (
          <form onSubmit={handleMfaSubmit} className="flex flex-col gap-5" data-testid="mfa-setup-form">
            <div>
              <h2 className="font-body text-xl font-bold text-charcoal dark:text-warm-paper tracking-tight">
                {labels.mfaSetupTitle}
              </h2>
              <p className="text-xs text-charcoal/70 dark:text-warm-paper/70 mt-1">
                Scan the QR code or enter this secret in your authenticator app.
              </p>
            </div>

            <div className="p-4 bg-sand/40 dark:bg-charcoal-deep border border-sand-border dark:border-sand-border/30 rounded-panel flex flex-col items-center gap-2">
              <span className="text-xs text-charcoal/70 dark:text-warm-paper/70 font-bold">
                {labels.mfaSecretLabel}
              </span>
              <code className="text-sm font-mono font-bold tracking-widest text-charcoal dark:text-warm-paper select-all">
                JBSWY3DPEHPK3PXP
              </code>
            </div>

            <Input
              type="text"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={labels.codePlaceholder}
              required
              className="text-center font-mono text-lg font-bold tracking-widest"
            />

            <Button type="submit" variant="primary" disabled={code.length < 6 || isLoading} isFullWidth>
              {labels.verifyButton}
            </Button>
          </form>
        )}

        {step === 'mfa_challenge' && (
          <form onSubmit={handleMfaSubmit} className="flex flex-col gap-5" data-testid="mfa-challenge-form">
            <div>
              <h2 className="font-body text-xl font-bold text-charcoal dark:text-warm-paper tracking-tight">
                {labels.mfaChallengeTitle}
              </h2>
              <p className="text-xs text-charcoal/70 dark:text-warm-paper/70 mt-1">
                Enter the 6-digit security code generated by your authenticator app.
              </p>
            </div>

            <Input
              type="text"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={labels.codePlaceholder}
              required
              className="text-center font-mono text-lg font-bold tracking-widest"
            />

            <Button type="submit" variant="primary" disabled={code.length < 6 || isLoading} isFullWidth>
              {labels.verifyButton}
            </Button>
          </form>
        )}

        {step === 'session_expired' && (
          <div className="flex flex-col gap-4 text-center" data-testid="session-expired-state">
            <EmptyState message={labels.sessionExpiredTitle} />
            <Button
              variant="primary"
              onClick={onRelogin || (() => setStep('otp_entry'))}
              isFullWidth
            >
              {labels.reloginButton}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
