import React from 'react';
import { cn } from './ActionButton';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string; // Required for screen reader accessibility
  tooltip?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  children: React.ReactNode;
}

/**
 * IconButton: Accessible icon button control with 44px touch target
 * and focus ring.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, tooltip, variant = 'ghost', className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        aria-label={label}
        title={tooltip || label}
        className={cn(
          'inline-flex items-center justify-center min-w-[44px] min-h-[44px] p-2.5 rounded-control transition-colors duration-150',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal dark:focus-visible:outline-bridge-orange',
          'disabled:opacity-50 disabled:cursor-not-allowed select-none',
          {
            'bg-bridge-orange text-charcoal hover:bg-[#E5790C]': variant === 'primary',
            'bg-warm-paper text-charcoal border border-sand-border hover:bg-sand dark:bg-charcoal dark:text-warm-paper':
              variant === 'secondary',
            'bg-transparent text-charcoal hover:bg-sand/60 dark:text-warm-paper dark:hover:bg-charcoal/50':
              variant === 'ghost',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
