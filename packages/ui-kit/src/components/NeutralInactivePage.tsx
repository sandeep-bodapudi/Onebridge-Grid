import React from 'react';

export interface NeutralInactivePageProps {
  title?: string;
  message?: string;
  supportHint?: string;
}

/**
 * Public Neutral Inactive Page (AC-3).
 * Strictly contains NO personal data (no names, phone numbers, emails, or company details).
 * Uses Span design tokens: 10px panel corners, no arches, minimum 12px text.
 */
export const NeutralInactivePage: React.FC<NeutralInactivePageProps> = ({
  title = 'Card or link inactive',
  message = 'This OneBridge Grid card, link, or NFC chip is currently inactive, disabled, or not yet activated.',
  supportHint = 'Please contact the company or cardholder directly for assistance.',
}) => {
  return (
    <main className="min-h-screen bg-warm-paper text-charcoal dark:bg-charcoal-deep dark:text-warm-paper flex flex-col items-center justify-center p-6 font-body">
      <div className="bg-white dark:bg-charcoal border border-sand-border dark:border-sand-border/30 rounded-panel p-8 max-w-md w-full shadow-overlay text-center">
        <div className="w-14 h-14 mx-auto mb-5 bg-sand/60 dark:bg-charcoal-deep rounded-control flex items-center justify-center text-charcoal/60 dark:text-warm-paper/60">
          <svg
            className="w-7 h-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-charcoal dark:text-warm-paper mb-3 tracking-tight">
          {title}
        </h1>

        <p className="text-sm text-charcoal/70 dark:text-warm-paper/70 leading-relaxed mb-5">
          {message}
        </p>

        <p className="text-xs text-charcoal/60 dark:text-warm-paper/60 leading-normal border-t border-sand-border dark:border-sand-border/30 pt-4">
          {supportHint}
        </p>

        <div className="mt-6 text-xs tracking-wider text-charcoal/50 dark:text-warm-paper/50 font-bold uppercase">
          OneBridge Grid &bull; Digital Business Identity
        </div>
      </div>
    </main>
  );
};
