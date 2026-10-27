import React, { useRef, useState } from 'react';
import { Button } from '@onebridge/ui-kit';
import { EMAIL_PATTERN, PasswordField, TextField } from './fields';

export interface EmailPasswordFormProps {
  onSubmit: (email: string, password: string) => void;
  isLoading?: boolean;
  forgotHref?: string;
}

/** D-AUTH-EMAIL: email + password sign-in. Fields check on blur and clear as you type. */
export const EmailPasswordForm: React.FC<EmailPasswordFormProps> = ({ onSubmit, isLoading = false, forgotHref = '/forgot-password' }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const emailError = (v: string) => (!v.trim() ? 'Enter your email.' : EMAIL_PATTERN.test(v.trim()) ? undefined : 'Enter an email like name@example.com.');
  const passwordError = (v: string) => (v ? undefined : 'Enter your password.');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = { email: emailError(email), password: passwordError(password) };
    setErrors(next);
    if (next.email) return emailRef.current?.focus();
    if (next.password) return passwordRef.current?.focus();
    onSubmit(email.trim(), password);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" data-testid="email-password-form">
      <TextField
        ref={emailRef}
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        error={errors.email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
        }}
        onBlur={() => email && setErrors((p) => ({ ...p, email: emailError(email) }))}
      />
      <PasswordField
        ref={passwordRef}
        label="Password"
        autoComplete="current-password"
        value={password}
        error={errors.password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
        }}
      />
      <div className="flex justify-end -mt-2">
        <a href={forgotHref} className="min-h-[44px] inline-flex items-center text-sm font-semibold text-charcoal underline underline-offset-2 dark:text-warm-paper">
          Forgot password?
        </a>
      </div>
      <Button type="submit" variant="primary" isLoading={isLoading} disabled={isLoading} isFullWidth>
        Sign in
      </Button>
    </form>
  );
};
