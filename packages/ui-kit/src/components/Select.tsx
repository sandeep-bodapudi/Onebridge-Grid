import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './ActionButton';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  hasError?: boolean;
}

/**
 * Select: Styled dropdown select control with custom SVG chevron and 44px min-height.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, hasError = false, className, disabled, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          disabled={disabled}
          className={cn(
            'w-full min-h-[44px] h-[44px] pl-3 pr-10 font-body text-sm rounded-control appearance-none transition-colors duration-150',
            'bg-warm-paper text-charcoal border border-sand-border',
            'dark:bg-charcoal dark:text-warm-paper dark:border-sand-border/30',
            'focus-visible:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange',
            'disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
            hasError ? 'border-error text-error' : '',
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-charcoal/60 dark:text-warm-paper/60">
          <ChevronDown className="w-4 h-4" aria-hidden="true" />
        </div>
      </div>
    );
  }
);

Select.displayName = 'Select';
