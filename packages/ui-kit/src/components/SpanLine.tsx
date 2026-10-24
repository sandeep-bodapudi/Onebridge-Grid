import React from 'react';
import { cn } from './ActionButton';

export interface SpanLineProps extends React.HTMLAttributes<HTMLDivElement> {
  animating?: boolean;
  className?: string;
  progressPercent?: number; // 0 to 100 for progress mode
}

/**
 * SpanLine: Signature OneBridge Grid deck divider.
 * Straight hairline with small square node termini at each end.
 */
export const SpanLine: React.FC<SpanLineProps> = ({
  animating = false,
  progressPercent,
  className,
  ...props
}) => {
  return (
    <div
      role="separator"
      data-span-line="true"
      className={cn('flex items-center w-full my-4 relative', className)}
      {...props}
    >
      {/* Left square node */}
      <div className="w-[5px] h-[5px] bg-charcoal dark:bg-warm-paper shrink-0" />

      {/* Center deck */}
      <div className="flex-1 h-[1.5px] bg-charcoal dark:bg-warm-paper relative overflow-hidden">
        {progressPercent !== undefined ? (
          <div
            className="h-full bg-bridge-orange transition-all duration-200"
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        ) : animating ? (
          <div className="absolute inset-0 bg-bridge-orange animate-span-fill motion-reduce:opacity-100" />
        ) : null}
      </div>

      {/* Right square node */}
      <div className="w-[5px] h-[5px] bg-charcoal dark:bg-warm-paper shrink-0" />
    </div>
  );
};
