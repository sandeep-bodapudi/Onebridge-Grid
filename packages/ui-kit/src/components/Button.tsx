import React from 'react';
import { cn } from './ActionButton';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  isFullWidth?: boolean;
  children: React.ReactNode;
}

/**
 * Button: Standard OneBridge Grid interactive action control.
 * Adheres strictly to the "Span" design tokens:
 * - 6px corner radius (control token)
 * - 44px minimum touch target (56px for primary on mobile)
 * - Bridge Orange fill carries Charcoal text (WCAG AA ratio 5.1:1)
 * - Visible 2px focus ring with 2px offset
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      isLoading = false,
      isFullWidth = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center font-bold text-sm rounded-control px-4 py-2.5 transition-colors duration-150',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal dark:focus-visible:outline-bridge-orange',
          'disabled:opacity-50 disabled:cursor-not-allowed select-none',
          // Desktop min-height 44px; mobile primary 56px
          variant === 'primary' ? 'min-h-[56px] sm:min-h-[44px]' : 'min-h-[44px]',
          isFullWidth ? 'w-full' : '',
          {
            // Orange is fill only, text is ALWAYS charcoal
            'bg-bridge-orange text-charcoal hover:bg-[#E5790C] active:bg-[#D66F09]':
              variant === 'primary',
            // Secondary: Panel surface with 1px Sand hairline border
            'bg-warm-paper text-charcoal border border-sand-border hover:bg-sand active:bg-sand-border dark:bg-charcoal dark:text-warm-paper dark:border-sand-border/30 dark:hover:bg-charcoal-deep':
              variant === 'secondary',
            // Ghost: Transparent with hover
            'bg-transparent text-charcoal hover:bg-sand/60 dark:text-warm-paper dark:hover:bg-charcoal/50':
              variant === 'ghost',
            // Destructive: Clear error styling
            'bg-error text-white hover:bg-[#A92E24] active:bg-[#8F271E]':
              variant === 'destructive',
          },
          className
        )}
        {...props}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="w-4 h-4 animate-spin motion-reduce:hidden"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
            <span>Loading...</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
