import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ActionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  isLoading?: boolean;
};

export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ className, variant = 'primary', isLoading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center rounded-16 px-24 py-12 font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bridge-orange disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-bridge-orange text-charcoal hover:bg-opacity-90': variant === 'primary',
            'bg-charcoal text-warm-paper dark:bg-warm-paper dark:text-charcoal hover:bg-charcoal-deep': variant === 'secondary',
            'bg-transparent text-charcoal hover:bg-sand dark:text-warm-paper dark:hover:bg-charcoal-deep': variant === 'ghost',
          },
          className
        )}
        {...props}
      >
        {isLoading ? <span className="animate-pulse">Loading...</span> : children}
      </button>
    );
  }
);
ActionButton.displayName = 'ActionButton';
