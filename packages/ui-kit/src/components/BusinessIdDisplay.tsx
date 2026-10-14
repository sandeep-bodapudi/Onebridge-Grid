import React, { useState } from 'react';
import { cn } from './ActionButton';

export interface BusinessIdDisplayLabels {
  copyButtonAriaLabel?: string;
  copiedText?: string;
  copyText?: string;
  offlineBadge?: string;
  emptyText?: string;
  label?: string;
}

export interface BusinessIdDisplayProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onCopy'> {
  businessId?: string;
  variant?: 'settings' | 'rail' | 'public' | 'badge';
  isLoading?: boolean;
  isEmpty?: boolean;
  isOffline?: boolean;
  onCopy?: (id: string) => void;
  copyFeedbackDurationMs?: number;
  labels?: BusinessIdDisplayLabels;
}

const defaultLabels: Required<BusinessIdDisplayLabels> = {
  copyButtonAriaLabel: 'Copy Business ID to clipboard',
  copiedText: 'Copied!',
  copyText: 'Copy',
  offlineBadge: 'Offline',
  emptyText: 'No Business ID available',
  label: 'Business ID',
};

export const BusinessIdDisplay: React.FC<BusinessIdDisplayProps> = ({
  businessId = '',
  variant = 'badge',
  isLoading = false,
  isEmpty = false,
  isOffline = false,
  onCopy,
  copyFeedbackDurationMs = 2000,
  labels: customLabels,
  className,
  ...props
}) => {
  const [copied, setCopied] = useState(false);
  const labels = { ...defaultLabels, ...customLabels };

  const handleCopy = async () => {
    if (!businessId || isLoading || isEmpty) return;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(businessId);
      }
      setCopied(true);
      onCopy?.(businessId);
      setTimeout(() => setCopied(false), copyFeedbackDurationMs);
    } catch {
      // Graceful fallback for environments blocking clipboard access
      setCopied(false);
    }
  };

  if (isLoading) {
    return (
      <div
        data-testid="business-id-loading"
        className={cn(
          'inline-flex items-center gap-8 p-8 rounded-12 bg-sand/30 animate-pulse',
          variant === 'settings' && 'w-full max-w-sm p-16 rounded-16',
          className
        )}
        {...props}
      >
        <div className="h-20 w-32 bg-charcoal/20 rounded-8" />
        <button
          type="button"
          disabled
          aria-label={labels.copyButtonAriaLabel}
          className="min-h-[44px] min-w-[44px] opacity-40 cursor-not-allowed"
        />
      </div>
    );
  }

  if (isEmpty || !businessId.trim()) {
    return (
      <div
        data-testid="business-id-empty"
        className={cn(
          'inline-flex items-center gap-8 text-xs font-bold text-charcoal/60 dark:text-warm-paper/60 p-8 rounded-12 bg-sand/20',
          className
        )}
        {...props}
      >
        <span>{labels.emptyText}</span>
      </div>
    );
  }

  // Variant: Admin Settings Card
  if (variant === 'settings') {
    return (
      <div
        data-testid="business-id-settings"
        className={cn(
          'p-16 rounded-16 bg-white dark:bg-charcoal border border-sand-border space-y-8 shadow-sm',
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-wider text-charcoal/70 dark:text-warm-paper/70">
            {labels.label}
          </span>
          {isOffline && (
            <span
              data-testid="business-id-offline-indicator"
              className="text-xs font-bold text-deep-orange px-8 py-2 rounded-8 bg-warning/10"
            >
              {labels.offlineBadge}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-12 bg-sand/30 dark:bg-charcoal-deep/50 p-8 rounded-12">
          <span
            data-testid="business-id-value"
            className="font-mono text-base font-extrabold text-charcoal dark:text-warm-paper tracking-wide px-8"
          >
            {businessId}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            data-testid="btn-copy-business-id"
            aria-label={copied ? labels.copiedText : labels.copyButtonAriaLabel}
            className={cn(
              'min-h-[44px] min-w-[44px] px-16 py-8 rounded-12 font-bold text-xs transition-colors duration-150 motion-reduce:transition-none flex items-center justify-center gap-4 focus-visible:outline-2 focus-visible:outline-bridge-orange',
              copied
                ? 'bg-success text-white'
                : 'bg-bridge-orange text-charcoal hover:bg-opacity-90'
            )}
          >
            {copied ? (
              <>
                <span aria-hidden="true">✓</span>
                <span>{labels.copiedText}</span>
              </>
            ) : (
              <>
                <span aria-hidden="true">📋</span>
                <span>{labels.copyText}</span>
              </>
            )}
          </button>
        </div>
        <span aria-live="polite" className="sr-only">
          {copied ? labels.copiedText : ''}
        </span>
      </div>
    );
  }

  // Variant: Admin Left Rail Footer
  if (variant === 'rail') {
    return (
      <div
        data-testid="business-id-rail"
        className={cn(
          'flex items-center justify-between p-8 rounded-12 bg-charcoal-deep text-warm-paper text-xs border border-charcoal/40',
          className
        )}
        {...props}
      >
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-warm-paper/60 uppercase">
            {labels.label}
          </span>
          <span data-testid="business-id-value" className="font-mono font-bold">
            {businessId}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          data-testid="btn-copy-business-id"
          aria-label={copied ? labels.copiedText : labels.copyButtonAriaLabel}
          className={cn(
            'min-h-[44px] min-w-[44px] px-8 rounded-8 font-bold text-xs transition-colors duration-150 motion-reduce:transition-none flex items-center justify-center focus-visible:outline-2 focus-visible:outline-bridge-orange',
            copied
              ? 'bg-success text-white'
              : 'bg-bridge-orange text-charcoal hover:bg-opacity-90'
          )}
        >
          {copied ? '✓' : 'Copy'}
        </button>
        <span aria-live="polite" className="sr-only">
          {copied ? labels.copiedText : ''}
        </span>
      </div>
    );
  }

  // Variant: Public Profile Footer
  if (variant === 'public') {
    return (
      <div
        data-testid="business-id-public"
        className={cn(
          'inline-flex items-center gap-12 p-8 rounded-16 bg-warm-paper dark:bg-charcoal border border-sand-border text-xs',
          className
        )}
        {...props}
      >
        <span className="font-bold text-charcoal/70 dark:text-warm-paper/70">
          {labels.label}:
        </span>
        <span data-testid="business-id-value" className="font-mono font-bold text-charcoal dark:text-warm-paper">
          {businessId}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          data-testid="btn-copy-business-id"
          aria-label={copied ? labels.copiedText : labels.copyButtonAriaLabel}
          className={cn(
            'min-h-[44px] min-w-[44px] px-12 py-6 rounded-12 font-bold transition-colors duration-150 motion-reduce:transition-none flex items-center justify-center',
            copied
              ? 'bg-success text-white'
              : 'bg-sand hover:bg-sand-border text-charcoal dark:bg-charcoal-deep dark:text-warm-paper'
          )}
        >
          {copied ? labels.copiedText : labels.copyText}
        </button>
        <span aria-live="polite" className="sr-only">
          {copied ? labels.copiedText : ''}
        </span>
      </div>
    );
  }

  // Default: Compact Badge
  return (
    <div
      data-testid="business-id-badge"
      className={cn(
        'inline-flex items-center gap-8 px-12 py-6 rounded-12 bg-sand/40 dark:bg-charcoal/60 border border-sand-border text-xs font-bold',
        className
      )}
      {...props}
    >
      <span className="text-charcoal/60 dark:text-warm-paper/60 uppercase text-[10px]">
        {labels.label}
      </span>
      <span data-testid="business-id-value" className="font-mono text-charcoal dark:text-warm-paper">
        {businessId}
      </span>
      {isOffline && (
        <span
          data-testid="business-id-offline-indicator"
          className="text-deep-orange text-[10px] px-4 py-1 rounded-4 bg-warning/10"
        >
          {labels.offlineBadge}
        </span>
      )}
      <button
        type="button"
        onClick={handleCopy}
        data-testid="btn-copy-business-id"
        aria-label={copied ? labels.copiedText : labels.copyButtonAriaLabel}
        className={cn(
          'min-h-[44px] min-w-[44px] px-8 py-4 rounded-8 font-bold transition-colors duration-150 motion-reduce:transition-none flex items-center justify-center focus-visible:outline-2 focus-visible:outline-bridge-orange',
          copied
            ? 'bg-success text-white'
            : 'bg-bridge-orange text-charcoal hover:bg-opacity-90'
        )}
      >
        {copied ? '✓' : labels.copyText}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? labels.copiedText : ''}
      </span>
    </div>
  );
};
