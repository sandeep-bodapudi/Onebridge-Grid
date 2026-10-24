import React from 'react';
import { cn } from './ActionButton';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  rounded?: 'control' | 'panel' | 'sheet' | 'full';
}

/**
 * Skeleton: Accessible placeholder loader.
 * Respects prefers-reduced-motion: pulses normally, switches to static opacity under reduced motion.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  rounded = 'control',
  className,
  style,
  ...props
}) => {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'bg-sand/70 dark:bg-charcoal/70 animate-pulse motion-reduce:animate-none motion-reduce:opacity-60',
        {
          'rounded-control': rounded === 'control',
          'rounded-panel': rounded === 'panel',
          'rounded-sheet': rounded === 'sheet',
          'rounded-full': rounded === 'full',
        },
        className
      )}
      style={{
        width,
        height,
        ...style,
      }}
      {...props}
    />
  );
};
