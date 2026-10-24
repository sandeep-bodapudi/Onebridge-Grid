import React from 'react';
import { cn } from './ActionButton';
import { Button } from './Button';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message?: string; // Backward compatibility
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

/**
 * EmptyState: Displayed when lists or containers have no content.
 * Strictly uses sentence case and clear CTA.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  description,
  actionLabel,
  onAction,
  icon,
  className,
  ...props
}) => {
  const displayTitle = title || message || 'No items to display';
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center border border-dashed border-sand-border dark:border-sand-border/30 rounded-panel bg-warm-paper/50 dark:bg-charcoal/30',
        className
      )}
      {...props}
    >
      {icon ? (
        <div className="mb-4 text-charcoal/40 dark:text-warm-paper/40">{icon}</div>
      ) : (
        <div className="w-10 h-10 mb-4 rounded-control bg-sand/60 dark:bg-charcoal flex items-center justify-center text-charcoal/50 dark:text-warm-paper/50 font-bold">
          —
        </div>
      )}

      <h3 className="font-body text-base font-bold text-charcoal dark:text-warm-paper">
        {displayTitle}
      </h3>

      {description && (
        <p className="mt-1 text-sm text-charcoal/70 dark:text-warm-paper/70 max-w-sm">
          {description}
        </p>
      )}

      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
