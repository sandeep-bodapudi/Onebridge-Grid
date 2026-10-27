import React from 'react';
import { cn } from './ActionButton';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

/**
 * Input: Standard single-line text input control.
 * 44px height, 6px radius, 1px Sand hairline border, charcoal/orange focus ring.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ hasError = false, className, disabled, ...props }, ref) => {
    return (
      <input
        ref={ref}
        disabled={disabled}
        className={cn(
          'w-full min-h-[44px] h-[44px] px-3 font-body text-sm rounded-control transition-colors duration-150',
          'bg-warm-paper text-charcoal border border-sand-border',
          'placeholder:text-charcoal/40 dark:placeholder:text-warm-paper/40',
          // Dark: the field sits below the charcoal panel with an edge at ~4.2:1 against it (WCAG 1.4.11).
          'dark:bg-charcoal-deep dark:text-warm-paper dark:border-warm-paper/45',
          'focus-visible:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          hasError
            ? 'border-error focus:border-error focus:ring-error text-error dark:border-error'
            : '',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
