import React from 'react';
import { cn } from './ActionButton';

export interface KeystoneTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  label?: string;
  className?: string;
}

/**
 * KeystoneTag: Verified company badge designed in the "Span" language.
 * Straight polygon trapezoid chip (wider at top, narrower at bottom), no curved geometry.
 */
export const KeystoneTag: React.FC<KeystoneTagProps> = ({
  label = 'Verified company',
  className,
  ...props
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-warm-paper bg-charcoal dark:bg-charcoal-deep dark:border dark:border-sand-border/40',
        className
      )}
      style={{
        clipPath: 'polygon(0 0, 100% 0, calc(100% - 4px) 100%, 4px 100%)',
      }}
      role="status"
      aria-label={label}
      {...props}
    >
      <svg
        className="w-3 h-3 fill-bridge-orange shrink-0"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
      </svg>
      <span>{label}</span>
    </span>
  );
};
