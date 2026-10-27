import React, { useState } from 'react';
import { Button, OtpInput } from '@onebridge/ui-kit';

export interface CodeStepProps {
  title: string;
  maskedEmail: string;
  onVerify: (code: string) => void;
  onResend: () => void;
  onBack: () => void;
  backLabel?: string;
  error?: string | null;
  isLoading?: boolean;
  resendSeconds?: number;
}

/** D-AUTH-EMAIL: the 6-digit email code, with a 60-second resend countdown. */
export const CodeStep: React.FC<CodeStepProps> = ({
  title,
  maskedEmail,
  onVerify,
  onResend,
  onBack,
  backLabel = 'Use a different email',
  error,
  isLoading = false,
  resendSeconds = 60,
}) => {
  const [code, setCode] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 6) onVerify(code);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" data-testid="code-step">
      <div>
        <h1 className="font-body text-xl font-bold text-charcoal dark:text-warm-paper tracking-tight">{title}</h1>
        <p className="text-sm text-charcoal/80 dark:text-warm-paper/80 mt-1">
          We sent a 6-digit code to <span className="font-semibold">{maskedEmail}</span>. It works for 10 minutes.
        </p>
      </div>
      <OtpInput
        value={code}
        onChange={setCode}
        onComplete={(full) => onVerify(full)}
        resendSeconds={resendSeconds}
        onResend={() => {
          setCode('');
          onResend();
        }}
        hasError={Boolean(error)}
        disabled={isLoading}
      />
      {error ? (
        <p role="alert" className="text-sm font-semibold text-error text-center">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" disabled={code.length < 6 || isLoading} isLoading={isLoading} isFullWidth>
        Continue
      </Button>
      <button type="button" onClick={onBack} className="min-h-[44px] self-center text-sm font-semibold text-charcoal underline underline-offset-2 dark:text-warm-paper">
        {backLabel}
      </button>
    </form>
  );
};
