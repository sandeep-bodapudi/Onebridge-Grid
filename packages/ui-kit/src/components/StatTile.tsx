import React from 'react';
import { cn } from './ActionButton';
import { Skeleton } from './Skeleton';

export interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  subtext?: string;
  highlight?: boolean;
  progressPercent?: number;
  isLoading?: boolean;
  error?: string;
  isEmpty?: boolean;
  className?: string;
}

/**
 * StatTile: Modular metric panel for Dashboard overview.
 * Features 1px Sand border, key number, subtext, and optional span progress bar.
 */
export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  subtext,
  highlight = false,
  progressPercent,
  isLoading = false,
  error,
  isEmpty = false,
  className,
  ...props
}) => {
  if (isLoading) {
    return (
      <div
        className={cn(
          'p-5 rounded-panel border border-sand-border dark:border-sand-border/30 bg-warm-paper dark:bg-charcoal flex flex-col justify-between gap-2 min-h-[110px]',
          className
        )}
        {...props}
      >
        <Skeleton width="50%" height={14} />
        <Skeleton width="75%" height={28} />
        <Skeleton width="40%" height={12} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          'p-5 rounded-panel border border-error/30 bg-error/10 text-error flex flex-col justify-center min-h-[110px]',
          className
        )}
        {...props}
      >
        <span className="text-xs font-bold">{label}</span>
        <span className="text-xs font-semibold mt-1">{error}</span>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div
        className={cn(
          'p-5 rounded-panel border border-sand-border dark:border-sand-border/30 bg-warm-paper dark:bg-charcoal flex flex-col justify-center text-charcoal/50 dark:text-warm-paper/50 min-h-[110px]',
          className
        )}
        {...props}
      >
        <span className="text-xs font-bold">{label}</span>
        <span className="text-xs mt-1">No data available</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'p-5 rounded-panel border border-sand-border dark:border-sand-border/30 bg-warm-paper dark:bg-charcoal flex flex-col justify-between gap-1.5 transition-colors duration-150',
        className
      )}
      {...props}
    >
      <div className="text-xs font-bold text-charcoal/70 dark:text-warm-paper/70 tracking-wide">
        {label}
      </div>

      <div
        className={cn('text-2xl font-bold tracking-tight', {
          'text-deep-orange dark:text-bridge-orange': highlight,
          'text-charcoal dark:text-warm-paper': !highlight,
        })}
      >
        {value}
      </div>

      {progressPercent !== undefined && (
        <div className="w-full h-1 bg-sand dark:bg-charcoal-deep overflow-hidden my-1">
          <div
            className="h-full bg-bridge-orange transition-all duration-200"
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>
      )}

      {subtext && (
        <div className="text-xs text-charcoal/60 dark:text-warm-paper/60 leading-tight">
          {subtext}
        </div>
      )}
    </div>
  );
};
