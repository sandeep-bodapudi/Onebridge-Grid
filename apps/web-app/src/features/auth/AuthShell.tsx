import React from 'react';
import { KeystoneTag, SpanLine, SpanMark } from '@onebridge/ui-kit';

/** The two-panel frame every sign-in screen shares: brand on the left (wide screens), the form on the right. */
export const AuthShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="w-full max-w-4xl mx-auto flex flex-col md:flex-row items-stretch rounded-sheet overflow-hidden border border-sand-border dark:border-sand-border/30 bg-warm-paper dark:bg-charcoal shadow-overlay">
    {/* Desktop Brand Panel */}
    <div className="hidden md:flex md:w-5/12 bg-charcoal text-warm-paper p-8 flex-col justify-between border-r border-sand-border/20">
      <div>
        <div className="flex items-center gap-2 mb-6">
          <SpanMark />
          <span className="font-bold text-base tracking-tight text-warm-paper">OneBridge Grid</span>
        </div>

        <h2 className="font-body text-xl font-bold tracking-tight text-warm-paper leading-snug">Your company-owned digital business identity.</h2>

        <SpanLine animating className="my-6 opacity-70" />

        {/* Sample Mini Card Preview */}
        <div className="p-4 rounded-panel bg-white/5 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-warm-paper/70">OB-DEMO01</span>
            <KeystoneTag label="Verified" />
          </div>
          <div className="space-y-0.5">
            <div className="text-sm font-bold text-warm-paper">Rohan Sharma</div>
            <div className="text-xs text-warm-paper/70">Managing director, Acme Infra</div>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-white/10 text-xs text-warm-paper/60">
        The company owns the identity, cards, and leads. Employees are custodians.
      </div>
    </div>

    {/* Main Interactive Auth Form Area */}
    <div className="w-full md:w-7/12 p-6 md:p-10 flex flex-col justify-center">{children}</div>
  </div>
);
