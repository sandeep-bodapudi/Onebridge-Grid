'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CardEditor,
  type CardEditorCard,
  type CardEditorSection,
  type CardEditorTemplate,
  cn,
} from '@onebridge/ui-kit';
import type { Card, Seat } from '@onebridge/api-contracts';
import { apiClient } from '../../api-client';

export interface CardsFeatureProps {
  tenantId: string;
  userRole?: string;
  /** Signed-in person; employees may edit only the card of their own seat. */
  personId?: string;
  /**
   * Extra content for the selected card (the dashboard passes the QR codes
   * feature here; features may not import each other directly).
   */
  renderCardExtras?: (card: { id: string; name: string }) => React.ReactNode;
  className?: string;
}

function toEditorCard(card: Card): CardEditorCard {
  return {
    id: card.id,
    slug: card.slug,
    templateId: card.templateId,
    status: card.status,
    approvalRequired: card.approvalRequired,
    sections: card.sections as unknown as CardEditorSection[],
  };
}

export const CardsFeature: React.FC<CardsFeatureProps> = ({ tenantId, userRole, personId, renderCardExtras, className }) => {
  const isAdmin = userRole === 'owner' || userRole === 'admin';
  const [seats, setSeats] = useState<Seat[]>([]);
  const [templates, setTemplates] = useState<CardEditorTemplate[]>([]);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [cardLoading, setCardLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setListLoading(true);
      try {
        const [seatPage, templateList] = await Promise.all([
          apiClient.listSeats(tenantId, { limit: 100 }),
          apiClient.listCardTemplates(tenantId),
        ]);
        if (cancelled) return;
        const visible = (seatPage.items || []).filter(
          (s) => s.status !== 'offboarded' && (isAdmin || !personId || s.personId === personId)
        );
        setSeats(visible);
        setTemplates(templateList);
        setSelectedSeatId((current) => current ?? visible[0]?.id ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load cards');
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, isAdmin, personId]);

  const loadCard = useCallback(
    async (seatId: string) => {
      setCardLoading(true);
      setError(null);
      try {
        setCard(await apiClient.getCard(seatId, tenantId));
      } catch (err) {
        setCard(null);
        setError(err instanceof Error ? err.message : 'Could not load the card');
      } finally {
        setCardLoading(false);
      }
    },
    [tenantId]
  );

  useEffect(() => {
    if (selectedSeatId) void loadCard(selectedSeatId);
  }, [selectedSeatId, loadCard]);

  const handleSave = async (update: { templateId: string; sections: CardEditorSection[] }) => {
    if (!card) return;
    setSaving(true);
    setError(null);
    try {
      setCard(
        await apiClient.updateCard(
          card.id,
          { templateId: update.templateId as Card['templateId'], sections: update.sections as unknown as Card['sections'] },
          tenantId
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the card');
    } finally {
      setSaving(false);
    }
  };

  const runPublish = async (action: 'publish' | 'approve') => {
    if (!card) return;
    setPublishing(true);
    setError(null);
    try {
      setCard(action === 'publish' ? await apiClient.publishCard(card.id, tenantId) : await apiClient.approveCard(card.id, tenantId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish the card');
    } finally {
      setPublishing(false);
    }
  };

  const cardPersonName = card
    ? String((card.sections.find((s) => s.type === 'about')?.content as Record<string, unknown> | undefined)?.name ?? '')
    : '';

  return (
    <div className={cn('grid grid-cols-1 gap-24 md:grid-cols-[260px_minmax(0,1fr)]', className)} data-testid="cards-feature">
      <nav aria-label="Seats" className="min-w-0 space-y-8">
        <h2 className="text-lg font-extrabold">Cards</h2>
        {listLoading ? (
          <div className="space-y-8" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-12 bg-sand" />
            ))}
          </div>
        ) : seats.length === 0 ? (
          <p className="text-sm text-charcoal/70 dark:text-warm-paper/70" data-testid="cards-empty">
            No seats yet. Add a seat under People and seats, and its card appears here.
          </p>
        ) : (
          <ul className="space-y-4">
            {seats.map((seat) => (
              <li key={seat.id}>
                <button
                  type="button"
                  onClick={() => setSelectedSeatId(seat.id)}
                  aria-current={seat.id === selectedSeatId ? 'true' : undefined}
                  className={cn(
                    'w-full min-h-[44px] rounded-12 px-12 py-8 text-left',
                    seat.id === selectedSeatId ? 'bg-bridge-orange/15 font-bold' : 'hover:bg-sand dark:hover:bg-charcoal'
                  )}
                  data-testid={`cards-seat-${seat.id}`}
                >
                  <span className="block">{seat.title}</span>
                  <span className="block truncate text-xs text-charcoal/60 dark:text-warm-paper/60">{seat.id}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <div className="min-w-0 space-y-24">
        <CardEditor
          card={card ? toEditorCard(card) : null}
          templates={templates}
          isAdmin={isAdmin}
          publicUrl={card ? apiClient.publicCardUrl(card.slug) : undefined}
          isLoading={cardLoading}
          isSaving={saving}
          isPublishing={publishing}
          error={error}
          onSave={handleSave}
          onPublish={() => runPublish('publish')}
          onApprove={() => runPublish('approve')}
        />
        {card && renderCardExtras ? renderCardExtras({ id: card.id, name: cardPersonName || card.id }) : null}
      </div>
    </div>
  );
};
