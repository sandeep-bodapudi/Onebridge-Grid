import React from 'react';
import { cn } from './ActionButton';

export interface SegmentedControlOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  name: string;
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * SegmentedControl: Accessible switch control between exclusive options.
 * Uses role="radiogroup" and keyboard navigation.
 */
export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  name,
  options,
  value,
  onChange,
  className,
}) => {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={cn(
        'inline-flex p-1 bg-sand/60 dark:bg-charcoal border border-sand-border dark:border-sand-border/30 rounded-control gap-1',
        className
      )}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(opt.value)}
            className={cn(
              'min-h-[38px] px-3.5 py-1.5 font-body text-xs font-bold rounded-control transition-all duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal dark:focus-visible:outline-bridge-orange',
              isSelected
                ? 'bg-charcoal text-warm-paper shadow-sm dark:bg-bridge-orange dark:text-charcoal'
                : 'bg-transparent text-charcoal/70 hover:text-charcoal hover:bg-sand/40 dark:text-warm-paper/70 dark:hover:text-warm-paper'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
