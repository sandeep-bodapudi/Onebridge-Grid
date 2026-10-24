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
      setCopied(false);
    }
  };

  if (isLoading) {
    return (
      <div
        data-testid="business-id-loading"
        className={cn(
          'inline-flex items-center gap-2 p-2 rounded-control bg-sand/30 animate-pulse',
          variant === 'settings' && 'w-full max-w-sm p-4 rounded-panel',
          className
        )}
        {...props}
      >
        <div className="h-5 w-8 bg-charcoal/20 rounded-control" />
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
          'inline-flex items-center gap-2 text-xs font-bold text-charcoal/60 dark:text-warm-paper/60 p-2 rounded-control bg-sand/20',
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
          'p-4 rounded-panel bg-white dark:bg-charcoal border border-sand-border dark:border-sand-border/30 space-y-2 shadow-sm',
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-charcoal/70 dark:text-warm-paper/70">
            {labels.label}
          </span>
          {isOffline && (
            <span
              data-testid="business-id-offline-indicator"
              className="text-xs font-bold text-deep-orange px-2 py-0.5 rounded-control bg-warning/10"
            >
              {labels.offlineBadge}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 bg-sand/30 dark:bg-charcoal-deep/50 p-2 rounded-control">
          <span
            data-testid="business-id-value"
            className="font-mono text-base font-bold text-charcoal dark:text-warm-paper tracking-wide px-2 select-all"
          >
            {businessId}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            data-testid="btn-copy-business-id"
            aria-label={copied ? labels.copiedText : labels.copyButtonAriaLabel}
            className={cn(
              'min-h-[44px] min-w-[44px] px-4 py-2 rounded-control font-bold text-xs transition-colors duration-150 motion-reduce:transition-none flex items-center justify-center gap-1 focus-visible:outline-2 focus-visible:outline-bridge-orange',
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
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>{labels.copyText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Variant: Left Navigation Rail
  if (variant === 'rail') {
    return (
      <div
        data-testid="business-id-rail"
        className={cn(
          'flex items-center justify-between gap-2 px-3 py-2 rounded-control bg-white/5 dark:bg-charcoal-deep/40 border border-white/10 dark:border-sand-border/20',
          className
        )}
        {...props}
      >
        <span
          data-testid="business-id-value"
          className="font-mono text-xs font-bold text-warm-paper dark:text-sand tracking-wider truncate select-all"
        >
          {businessId}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          data-testid="btn-copy-business-id"
          aria-label={copied ? labels.copiedText : labels.copyButtonAriaLabel}
          className="min-h-[44px] min-w-[44px] p-2 rounded-control text-warm-paper/70 hover:text-warm-paper hover:bg-white/10 transition-colors flex items-center justify-center focus-visible:outline-2 focus-visible:outline-bridge-orange"
        >
          {copied ? (
            <span className="text-success text-xs font-bold" aria-hidden="true">✓</span>
          ) : (
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>
    );
  }

  // Variant: Public Visitor Card
  if (variant === 'public') {
    return (
      <div
        data-testid="business-id-public"
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-control bg-sand/60 dark:bg-charcoal-deep/60 border border-sand-border dark:border-sand-border/30',
          className
        )}
        {...props}
      >
        <span className="text-xs font-bold uppercase tracking-wider text-charcoal/60 dark:text-warm-paper/60">
          ID:
        </span>
        <span
          data-testid="business-id-value"
          className="font-mono text-xs font-bold text-charcoal dark:text-warm-paper tracking-wider select-all"
        >
          {businessId}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          data-testid="btn-copy-business-id"
          aria-label={copied ? labels.copiedText : labels.copyButtonAriaLabel}
          className="min-h-[44px] min-w-[44px] p-2 rounded-control text-charcoal/60 dark:text-warm-paper/60 hover:text-charcoal dark:hover:text-warm-paper transition-colors flex items-center justify-center focus-visible:outline-2 focus-visible:outline-bridge-orange"
        >
          {copied ? (
            <span className="text-success text-xs font-bold" aria-hidden="true">✓</span>
          ) : (
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>
    );
  }

  // Variant: Default Compact Badge
  return (
    <div
      data-testid="business-id-badge"
      className={cn(
        'inline-flex items-center gap-2 px-2.5 py-1 rounded-control bg-sand/80 dark:bg-charcoal border border-sand-border dark:border-sand-border/30',
        className
      )}
      {...props}
    >
      <span
        data-testid="business-id-value"
        className="font-mono text-xs font-bold text-charcoal dark:text-warm-paper tracking-wider select-all"
      >
        {businessId}
      </span>
      {isOffline && (
        <span
          data-testid="business-id-offline-indicator"
          className="text-[10px] font-bold text-deep-orange px-1.5 py-0.5 rounded-control bg-warning/15 dark:bg-warning/20"
        >
          {labels.offlineBadge}
        </span>
      )}
      <button
        type="button"
        onClick={handleCopy}
        data-testid="btn-copy-business-id"
        aria-label={copied ? labels.copiedText : labels.copyButtonAriaLabel}
        className="min-h-[44px] min-w-[44px] p-2 rounded-control text-charcoal/60 dark:text-warm-paper/60 hover:text-charcoal dark:hover:text-warm-paper transition-colors flex items-center justify-center focus-visible:outline-2 focus-visible:outline-bridge-orange"
      >
        {copied ? (
          <span className="text-success text-xs font-bold flex items-center gap-1">
            <span aria-hidden="true">✓</span>
            <span>{labels.copiedText}</span>
          </span>
        ) : (
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </div>
  );
};

export const BusinessIdNameplate = BusinessIdDisplay;
