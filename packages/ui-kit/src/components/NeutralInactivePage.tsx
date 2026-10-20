import React from 'react';

export interface NeutralInactivePageProps {
  title?: string;
  message?: string;
  supportHint?: string;
}

/**
 * Public Neutral Inactive Page (AC-3).
 * Strictly contains NO personal data (no names, phone numbers, emails, or company details).
 */
export const NeutralInactivePage: React.FC<NeutralInactivePageProps> = ({
  title = 'Card or link inactive',
  message = 'This OneBridge Grid card, link, or NFC chip is currently inactive, disabled, or not yet activated.',
  supportHint = 'Please contact the company or cardholder directly for assistance.',
}) => {
  return (
    <main className="min-h-screen bg-sand text-charcoal flex flex-col items-center justify-center p-24 font-body">
      <div className="bg-white border border-sand-border rounded-16 p-32 max-w-md w-full shadow-sm text-center">
        <div className="w-56 h-56 mx-auto mb-20 bg-sand/60 rounded-full flex items-center justify-center text-charcoal/60">
          <svg
            className="w-28 h-28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-charcoal mb-12 tracking-tight">
          {title}
        </h1>

        <p className="text-sm text-charcoal/70 leading-relaxed mb-20">
          {message}
        </p>

        <p className="text-xs text-charcoal/40 leading-normal border-t border-sand-border pt-16">
          {supportHint}
        </p>

        <div className="mt-24 text-[10px] tracking-wider text-charcoal/40 font-bold uppercase">
          OneBridge Grid &bull; Digital Business Identity
        </div>
      </div>
    </main>
  );
};
