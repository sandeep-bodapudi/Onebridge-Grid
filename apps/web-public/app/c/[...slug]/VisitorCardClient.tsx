'use client';

import React, { useEffect } from 'react';
import { VisitorCard, type VisitorCardData, type VisitorCardProps, type SharebackSubmitData } from '@onebridge/ui-kit';

export interface VisitorCardClientProps {
  card?: VisitorCardData;
  state?: VisitorCardProps['state'];
  companyName?: string;
  offboardedDetails?: VisitorCardProps['offboardedDetails'];
  source?: 'qr' | 'nfc' | 'link';
  sourceTag?: string;
}

export function VisitorCardClient({
  card,
  state = 'ready',
  companyName,
  offboardedDetails,
  source,
  sourceTag,
}: VisitorCardClientProps) {
  const sendAnalytics = (type: string, metadata?: Record<string, unknown>) => {
    try {
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          cardId: card?.cardId,
          slug: card?.slug,
          metadata,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {
        // Non-blocking telemetry
      });
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    if (state === 'ready' && card?.cardId) {
      sendAnalytics('card_viewed');
    }
  }, [card?.cardId, state]);

  const handleSharebackSubmit = async (data: SharebackSubmitData) => {
    try {
      const res = await fetch('/api/shareback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: card?.slug,
          ...data,
          source: data.source || source,
          sourceTag: data.sourceTag || sourceTag,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return {
          success: false,
          message: errorData.detail || errorData.message || 'Failed to send details. Please try again.',
        };
      }

      sendAnalytics('shareback_submitted', {
        source: data.source || source,
        sourceTag: data.sourceTag || sourceTag,
      });
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error. Please try again.';
      return {
        success: false,
        message,
      };
    }
  };

  return (
    <VisitorCard
      data={card}
      state={state}
      companyName={companyName}
      offboardedDetails={offboardedDetails}
      source={source}
      sourceTag={sourceTag}
      onSaveContact={({ cardId, slug }) => sendAnalytics('contact_saved', { cardId, slug })}
      onCtaClick={(cta) => sendAnalytics('cta_clicked', { cta })}
      onSharebackSubmit={handleSharebackSubmit}
    />
  );
}
