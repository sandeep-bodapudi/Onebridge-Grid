import React from 'react';
import { cn } from './ActionButton';
import { Skeleton } from './Skeleton';

export interface QrPreviewProps extends React.HTMLAttributes<HTMLDivElement> {
  qrSvgOrImage?: React.ReactNode;
  shortLink?: string;
  isLoading?: boolean;
  error?: string;
  onCopyLink?: () => void;
  onDownloadPng?: () => void;
  className?: string;
}

/**
 * QrPreview: Clean branded QR preview container with copy and download actions.
 */
export const QrPreview: React.FC<QrPreviewProps> = ({
  qrSvgOrImage,
  shortLink,
  isLoading = false,
  error,
  onCopyLink,
  onDownloadPng,
  className,
  ...props
}) => {
  if (isLoading) {
    return (
      <div
        className={cn(
          'p-6 rounded-panel border border-sand-border dark:border-sand-border/30 bg-warm-paper dark:bg-charcoal flex flex-col items-center justify-center gap-4 min-h-[260px]',
          className
        )}
        {...props}
      >
        <Skeleton width={180} height={180} rounded="panel" />
        <Skeleton width={120} height={16} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          'p-6 rounded-panel border border-error/30 bg-error/10 text-error flex flex-col items-center justify-center min-h-[260px]',
          className
        )}
        {...props}
      >
        <p className="text-sm font-bold">{error}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'p-6 rounded-panel border border-sand-border dark:border-sand-border/30 bg-warm-paper dark:bg-charcoal flex flex-col items-center gap-4',
        className
      )}
      {...props}
    >
      <div className="p-3 bg-white border border-sand-border rounded-control shadow-sm flex items-center justify-center">
        {qrSvgOrImage || (
          <div className="w-44 h-44 flex items-center justify-center font-mono text-xs text-charcoal/50">
            QR Code
          </div>
        )}
      </div>

      {shortLink && (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-charcoal/80 dark:text-warm-paper/80 select-all">
            {shortLink}
          </span>
          {onCopyLink && (
            <button
              type="button"
              onClick={onCopyLink}
              className="text-xs font-bold text-deep-orange hover:underline focus-visible:outline-none"
            >
              Copy
            </button>
          )}
        </div>
      )}

      {onDownloadPng && (
        <button
          type="button"
          onClick={onDownloadPng}
          className="text-xs font-bold text-charcoal/80 hover:text-charcoal dark:text-warm-paper/80 dark:hover:text-warm-paper border border-sand-border rounded-control px-3 py-1.5 hover:bg-sand/40"
        >
          Download PNG
        </button>
      )}
    </div>
  );
};
