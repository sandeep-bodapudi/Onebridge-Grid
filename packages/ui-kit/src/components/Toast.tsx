import React from 'react';
import { cn } from './ActionButton';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastProps {
  message: string;
  type?: ToastType;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Toast: Accessible live region notification.
 * Uses role="status" and aria-live="polite".
 */
export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  onDismiss,
  className,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-3 rounded-control text-sm font-semibold shadow-overlay border',
        {
          'bg-warm-paper text-charcoal border-sand-border dark:bg-charcoal dark:text-warm-paper':
            type === 'info',
          'bg-success/15 text-success border-success/30 dark:bg-success/20 dark:text-[#34A853]':
            type === 'success',
          'bg-warning/15 text-deep-orange border-warning/30 dark:bg-warning/20 dark:text-[#FBBC04]':
            type === 'warning',
          'bg-error/15 text-error border-error/30 dark:bg-error/20 dark:text-[#EA4335]':
            type === 'error',
        },
        className
      )}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="text-current opacity-70 hover:opacity-100 p-1 focus-visible:outline-none"
        >
          ✕
        </button>
      )}
    </div>
  );
};
