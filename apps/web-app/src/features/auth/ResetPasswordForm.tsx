import React, { useRef, useState } from 'react';
import { Button } from '@onebridge/ui-kit';
import { CodeSentResponse } from '../../api-client';
import { CodeStep } from './CodeStep';
import { EMAIL_PATTERN, FormError, PasswordField, TextField } from './fields';
import { authErrorText, isCodeProblem } from './auth-errors';

export interface ResetPasswordFormProps {
  requestCode: (email: string) => Promise<CodeSentResponse>;
  resendCode: (ticket: string) => Promise<unknown>;
  resetPassword: (ticket: string, code: string, newPassword: string) => Promise<void>;
  signInHref?: string;
}

type Stage = 'email' | 'code' | 'password' | 'done';

/** D-AUTH-EMAIL: forgot password, in four steps: email, code, new password, done. */
export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ requestCode, resendCode, resetPassword, signInHref = '/login' }) => {
  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<CodeSentResponse | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fieldRef = useRef<HTMLInputElement>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      if (isCodeProblem(err)) {
        // The code was wrong or used up: go back to the code step with the reason.
        setStage('code');
      }
      setError(authErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (stage === 'email') {
    return (
      <form
        noValidate
        data-testid="forgot-email-form"
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!EMAIL_PATTERN.test(email.trim())) {
            setFieldError('Enter an email like name@example.com.');
            fieldRef.current?.focus();
            return;
          }
          void run(async () => {
            setSent(await requestCode(email.trim()));
            setStage('code');
          });
        }}
      >
        <div>
          <h1 className="font-body text-xl font-bold text-charcoal dark:text-warm-paper tracking-tight">Reset your password</h1>
          <p className="text-sm text-charcoal/80 dark:text-warm-paper/80 mt-1">Enter the email you use for OneBridge. If it has an account, we&apos;ll send a code.</p>
        </div>
        <FormError message={error} />
        <TextField
          ref={fieldRef}
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          error={fieldError}
          onChange={(e) => {
            setEmail(e.target.value);
            setFieldError(null);
          }}
        />
        <Button type="submit" variant="primary" isLoading={busy} disabled={busy} isFullWidth>
          Send code
        </Button>
        <a href={signInHref} className="min-h-[44px] self-center inline-flex items-center text-sm font-semibold text-charcoal underline underline-offset-2 dark:text-warm-paper">
          Back to sign in
        </a>
      </form>
    );
  }

  if (stage === 'code' && sent) {
    return (
      <CodeStep
        title="Check your email"
        maskedEmail={sent.maskedEmail}
        error={error}
        isLoading={busy}
        onVerify={(c) => {
          setCode(c);
          setError(null);
          setStage('password');
        }}
        onResend={() => void run(async () => void (await resendCode(sent.ticket)))}
        onBack={() => {
          setStage('email');
          setError(null);
        }}
      />
    );
  }

  if (stage === 'password' && sent) {
    return (
      <form
        noValidate
        data-testid="new-password-form"
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if ([...password].length < 10) {
            setFieldError('Use at least 10 characters.');
            fieldRef.current?.focus();
            return;
          }
          void run(async () => {
            await resetPassword(sent.ticket, code, password);
            setStage('done');
          });
        }}
      >
        <div>
          <h1 className="font-body text-xl font-bold text-charcoal dark:text-warm-paper tracking-tight">Choose a new password</h1>
        </div>
        <FormError message={error} />
        <PasswordField
          ref={fieldRef}
          label="New password"
          autoComplete="new-password"
          hint="At least 10 characters. A few unrelated words make a strong one."
          value={password}
          error={fieldError}
          onChange={(e) => {
            setPassword(e.target.value);
            setFieldError(null);
          }}
        />
        <Button type="submit" variant="primary" isLoading={busy} disabled={busy} isFullWidth>
          Reset password
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="reset-done" role="status">
      <h1 className="font-body text-xl font-bold text-charcoal dark:text-warm-paper tracking-tight">Password changed</h1>
      <p className="text-sm text-charcoal/80 dark:text-warm-paper/80">
        Your new password is set, and every device that was signed in has been signed out. Sign in again to continue.
      </p>
      <a
        href={signInHref}
        className="min-h-[44px] inline-flex items-center justify-center rounded-control bg-charcoal text-warm-paper dark:bg-warm-paper dark:text-charcoal text-sm font-bold"
      >
        Sign in
      </a>
    </div>
  );
};
