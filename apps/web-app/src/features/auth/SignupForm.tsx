import React, { useRef, useState } from 'react';
import { Button } from '@onebridge/ui-kit';
import { EMAIL_PATTERN, PasswordField, TextField } from './fields';

export interface SignupValues {
  name: string;
  email: string;
  password: string;
}

export interface SignupFormProps {
  onSubmit: (values: SignupValues) => void;
  isLoading?: boolean;
  termsHref: string;
  privacyHref: string;
}

type Errors = Partial<Record<'name' | 'email' | 'password' | 'consent', string>>;

/** D-AUTH-EMAIL: create an account with name, email and password; the code step follows. */
export const SignupForm: React.FC<SignupFormProps> = ({ onSubmit, isLoading = false, termsHref, privacyHref }) => {
  const [values, setValues] = useState<SignupValues>({ name: '', email: '', password: '' });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const refs = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
    consent: useRef<HTMLInputElement>(null),
  };

  const check = {
    name: (v: string) => (v.trim() ? undefined : 'Enter your name.'),
    email: (v: string) => (!v.trim() ? 'Enter your email.' : EMAIL_PATTERN.test(v.trim()) ? undefined : 'Enter an email like name@example.com.'),
    password: (v: string) => {
      if ([...v].length < 10) return 'Use at least 10 characters.';
      if ([...v].length > 128) return 'Use at most 128 characters.';
      if (values.email && v.trim().toLowerCase() === values.email.trim().toLowerCase()) return "Don't use your email address as your password.";
      return undefined;
    },
  };

  const set = (key: keyof SignupValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((p) => ({ ...p, [key]: e.target.value }));
    if (errors[key]) setErrors((p) => ({ ...p, [key]: undefined }));
  };
  const blur = (key: keyof SignupValues) => () => values[key] && setErrors((p) => ({ ...p, [key]: check[key](values[key]) }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Errors = {
      name: check.name(values.name),
      email: check.email(values.email),
      password: check.password(values.password),
      consent: consent ? undefined : 'Accept the terms and the privacy policy to continue.',
    };
    setErrors(next);
    const first = (['name', 'email', 'password', 'consent'] as const).find((k) => next[k]);
    if (first) return refs[first].current?.focus();
    onSubmit({ name: values.name.trim(), email: values.email.trim(), password: values.password });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" data-testid="signup-form">
      <TextField ref={refs.name} label="Your name" autoComplete="name" value={values.name} error={errors.name} onChange={set('name')} onBlur={blur('name')} />
      <TextField
        ref={refs.email}
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={values.email}
        error={errors.email}
        onChange={set('email')}
        onBlur={blur('email')}
      />
      <PasswordField
        ref={refs.password}
        label="Password"
        autoComplete="new-password"
        hint="At least 10 characters. A few unrelated words make a strong one."
        value={values.password}
        error={errors.password}
        onChange={set('password')}
        onBlur={blur('password')}
      />
      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-3 text-sm text-charcoal dark:text-warm-paper cursor-pointer min-h-[44px]">
          <input
            ref={refs.consent}
            type="checkbox"
            checked={consent}
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={errors.consent ? 'signup-consent-error' : undefined}
            onChange={(e) => {
              setConsent(e.target.checked);
              if (errors.consent) setErrors((p) => ({ ...p, consent: undefined }));
            }}
            className="mt-1 h-5 w-5 shrink-0 rounded-control border-sand-border focus:ring-bridge-orange"
          />
          <span>
            I agree to the{' '}
            <a href={termsHref} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
              Terms of Service
            </a>{' '}
            and the{' '}
            <a href={privacyHref} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
              Privacy Policy
            </a>
            .
          </span>
        </label>
        {errors.consent ? (
          <p id="signup-consent-error" className="text-xs font-semibold text-error">
            {errors.consent}
          </p>
        ) : null}
      </div>
      <Button type="submit" variant="primary" isLoading={isLoading} disabled={isLoading} isFullWidth>
        Create account
      </Button>
    </form>
  );
};
