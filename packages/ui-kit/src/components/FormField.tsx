import React, { useState } from 'react';
import { cn } from './ActionButton';

export interface FormFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  validate?: (value: string) => string | undefined;
  children: (props: {
    id: string;
    hasError: boolean;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
    onBlur?: React.FocusEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;
    onChange?: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;
  }) => React.ReactNode;
}

/**
 * FormField: Accessible form wrapper with label, hint, and error message.
 * Adheres to: validates on blur, clears error on edit.
 */
export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  hint,
  error: externalError,
  required = false,
  className,
  validate,
  children,
}) => {
  const [internalError, setInternalError] = useState<string | undefined>();
  const activeError = externalError || internalError;

  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = activeError ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  const handleBlur: React.FocusEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> = (e) => {
    if (validate) {
      const err = validate(e.target.value);
      setInternalError(err);
    }
  };

  const handleChange: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> = () => {
    if (internalError) {
      setInternalError(undefined); // Clears on edit
    }
  };

  return (
    <div className={cn('flex flex-col gap-1.5 w-full', className)}>
      <div className="flex justify-between items-center">
        <label
          htmlFor={id}
          className="font-body text-xs font-bold text-charcoal dark:text-warm-paper tracking-wide"
        >
          {label} {required && <span className="text-deep-orange" aria-hidden="true">*</span>}
        </label>
      </div>

      {children({
        id,
        hasError: Boolean(activeError),
        'aria-describedby': describedBy,
        'aria-invalid': Boolean(activeError),
        onBlur: handleBlur,
        onChange: handleChange,
      })}

      {activeError ? (
        <p id={errorId} role="alert" className="text-xs font-semibold text-error mt-0.5">
          {activeError}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-charcoal/60 dark:text-warm-paper/60 mt-0.5">
          {hint}
        </p>
      ) : null}
    </div>
  );
};
