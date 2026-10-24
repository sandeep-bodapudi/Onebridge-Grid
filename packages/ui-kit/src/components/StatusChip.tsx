import React from 'react';
import { cn } from './ActionButton';

export type StatusVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'published'
  | 'draft'
  | 'unassigned'
  | 'archived';

export interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusVariant;
  children?: React.ReactNode;
}

const defaultLabels: Record<StatusVariant, string> = {
  success: 'Active',
  warning: 'Warning',
  error: 'Error',
  info: 'Information',
  published: 'Published',
  draft: 'Draft',
  unassigned: 'Unassigned',
  archived: 'Archived',
};

/**
 * StatusChip: 6px corner chip indicating business entity or card status.
 * Adheres strictly to WCAG AA contrast and sentence case.
 */
export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  children,
  className,
  ...props
}) => {
  const content = children || defaultLabels[status];

  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-control text-xs font-bold leading-none select-none',
        {
          'bg-success/15 text-success dark:bg-success/20 dark:text-[#34A853]':
            status === 'success' || status === 'published',
          'bg-warning/15 text-deep-orange dark:bg-warning/20 dark:text-[#FBBC04]':
            status === 'warning' || status === 'draft',
          'bg-error/15 text-error dark:bg-error/20 dark:text-[#EA4335]':
            status === 'error',
          'bg-info/15 text-info dark:bg-info/20 dark:text-[#4285F4]':
            status === 'info',
          'bg-sand text-charcoal/70 dark:bg-charcoal dark:text-warm-paper/70':
            status === 'unassigned' || status === 'archived',
        },
        className
      )}
      {...props}
    >
      <span
        className={cn('w-1.5 h-1.5 shrink-0', {
          'bg-success dark:bg-[#34A853]': status === 'success' || status === 'published',
          'bg-warning dark:bg-[#FBBC04]': status === 'warning' || status === 'draft',
          'bg-error dark:bg-[#EA4335]': status === 'error',
          'bg-info dark:bg-[#4285F4]': status === 'info',
          'bg-charcoal/50 dark:bg-warm-paper/50':
            status === 'unassigned' || status === 'archived',
        })}
        aria-hidden="true"
      />
      <span>{content}</span>
    </span>
  );
};
