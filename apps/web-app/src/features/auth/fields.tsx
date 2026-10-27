import React, { useId, useState } from 'react';
import { Input } from '@onebridge/ui-kit';

/** The input props these fields pass on (an explicit list: the app's and the ui-kit's React types differ). */
interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  id?: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  autoComplete?: string;
  inputMode?: 'email' | 'text' | 'numeric';
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** A labelled input whose hint and error are announced with the field (aria-describedby). */
export const TextField = React.forwardRef<HTMLInputElement, FieldProps>(({ label, hint, error, id, className, ...props }, ref) => {
  const auto = useId();
  const fieldId = id ?? auto;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-bold text-charcoal dark:text-warm-paper">
        {label}
      </label>
      <Input
        ref={ref}
        id={fieldId}
        hasError={Boolean(error)}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        className={className}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-xs text-charcoal/70 dark:text-warm-paper/70">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-semibold text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
});
TextField.displayName = 'TextField';

/** A password field with a Show / Hide toggle. */
export const PasswordField = React.forwardRef<HTMLInputElement, Omit<FieldProps, 'type'>>((props, ref) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <TextField ref={ref} type={visible ? 'text' : 'password'} {...props} className="pr-20" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-1 top-[26px] min-h-[44px] min-w-[44px] px-2 text-xs font-semibold text-charcoal underline underline-offset-2 dark:text-warm-paper"
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
});
PasswordField.displayName = 'PasswordField';

/** A plain banner for a form-level problem; role=alert so it is read out. */
export const FormError: React.FC<{ message?: string | null; testId?: string }> = ({ message, testId = 'auth-error-banner' }) =>
  message ? (
    <div role="alert" data-testid={testId} className="px-4 py-3 rounded-panel bg-error/10 text-sm text-charcoal dark:text-warm-paper border border-error/40">
      {message}
    </div>
  ) : null;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
