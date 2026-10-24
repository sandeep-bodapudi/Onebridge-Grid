'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import {
  CardEditor,
  type CardEditorCard,
  type CardEditorSection,
  type CardEditorTemplate,
  Avatar,
  Input,
  PageHeader,
  Skeleton,
  StatusChip,
  VisitorCard,
  type VisitorCardData,
  cn,
} from '@onebridge/ui-kit';
import type { Card, CardSummary, Seat } from '@onebridge/api-contracts';
import { apiClient } from '../../api-client';

export interface CardsFeatureProps {
  tenantId: string;
  userRole?: string;
  /** Signed-in person; employees may edit only the card of their own seat. */
  personId?: string;
  /** Company details for the live preview. */
  company?: { name: string; businessId: string; brandColours?: { band: string; accent?: string; text: string }; logoUrl?: string };
  /** Seat to open first (e.g. "Edit card" from People). */
  initialSeatId?: string | null;
  /**
   * Extra content for the selected card (the dashboard passes the QR codes
   * feature here; features may not import each other directly).
   */
  renderCardExtras?: (card: { id: string; name: string; status: Card['status'] }) => React.ReactNode;
  className?: string;
}

function toEditorCard(card: Card): CardEditorCard {
  return {
    id: card.id,
    slug: card.slug,
    templateId: card.templateId,
    status: card.status as CardEditorCard['status'],
    approvalRequired: card.approvalRequired,
    sections: card.sections as unknown as CardEditorSection[],
  };
}


/** Builds the visitor-page view of a card from the editor's (possibly unsaved) draft. */
function previewData(
  card: Card,
  draft: { templateId: string; sections: CardEditorSection[] },
  company: NonNullable<CardsFeatureProps['company']>
): VisitorCardData {
  const about = (draft.sections.find((s) => s.type === 'about')?.content ?? {}) as Record<string, string | undefined>;
  const phone = about.phone?.replace(/\D/g, '');
  return {
    cardId: card.id,
    slug: card.slug,
    status: 'published',
    templateId: draft.templateId,
    language: 'en',
    verifiedBadge: card.verifiedBadge,
    person: {
      name: about.name || 'Name on the card',
      designation: about.designation || '',
      photoUrl: about.photoUrl || undefined,
      phone: about.phone,
      email: about.email,
      bio: about.bio,
    },
    company: { id: card.tenantId, businessId: company.businessId, name: company.name, brandColours: company.brandColours, logoUrl: company.logoUrl },
    sections: draft.sections
      .filter((s) => s.enabled && s.visibility === 'public' && s.type !== 'about')
      .map((s) => ({ type: s.type, order: s.order, content: s.content })),
    actions: {
      saveContactUrl: '#',
      callUrl: phone ? `tel:${phone}` : undefined,
      whatsappUrl: phone ? `https://wa.me/${phone.length === 10 ? `91${phone}` : phone}` : undefined,
      emailUrl: about.email ? `mailto:${about.email}` : undefined,
    },
  };
}

export const CardsFeature: React.FC<CardsFeatureProps> = ({
  tenantId,
  userRole,
  personId,
  company,
  initialSeatId,
  renderCardExtras,
  className,
}) => {
  const isAdmin = userRole === 'owner' || userRole === 'admin';
  const [seats, setSeats] = useState<Seat[]>([]);
  const [summaries, setSummaries] = useState<Record<string, CardSummary>>({});
  const [templates, setTemplates] = useState<CardEditorTemplate[]>([]);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(initialSeatId ?? null);
  const [card, setCard] = useState<Card | null>(null);
  const [query, setQuery] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const [cardLoading, setCardLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadSummaries = useCallback(async () => {
    const list = await apiClient.listCardSummaries(tenantId).catch(() => [] as CardSummary[]);
    setSummaries(Object.fromEntries(list.map((c) => [c.seatId || c.id, c])));
  }, [tenantId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setListLoading(true);
      try {
        const [seatPage, templateList] = await Promise.all([
          apiClient.listSeats(tenantId, { limit: 100 }),
          apiClient.listCardTemplates(tenantId),
          loadSummaries(),
        ]);
        if (cancelled) return;
        const visible = (seatPage.items || []).filter(
          (s) => s.status !== 'offboarded' && (isAdmin || !personId || s.personId === personId)
        );
        setSeats(visible);
        setTemplates(templateList);
        setSelectedSeatId((current) => (current && visible.some((s) => s.id === current) ? current : visible[0]?.id ?? null));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load cards');
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, isAdmin, personId, loadSummaries]);

  useEffect(() => {
    if (initialSeatId) setSelectedSeatId(initialSeatId);
  }, [initialSeatId]);

  const loadCard = useCallback(
    async (seatId: string) => {
      setCardLoading(true);
      setError(null);
      setNotice(null);
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
      const saved = await apiClient.updateCard(
        card.id,
        { templateId: update.templateId as Card['templateId'], sections: update.sections as unknown as Card['sections'] },
        tenantId
      );
      setCard(saved);
      setNotice(saved.status === 'published' ? 'Saved. Visitors now see the updated card.' : 'Saved as a draft.');
      void loadSummaries();
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
      const published = action === 'publish' ? await apiClient.publishCard(card.id, tenantId) : await apiClient.approveCard(card.id, tenantId);
      setCard(published);
      setNotice(published.status === 'published' ? 'Published. The card and its QR code are live.' : 'Sent for approval.');
      void loadSummaries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish the card');
    } finally {
      setPublishing(false);
    }
  };

  const nameOf = (seat: Seat) => summaries[seat.id]?.name?.trim() || '';
  const filtered = seats.filter((seat) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${nameOf(seat)} ${seat.title}`.toLowerCase().includes(q);
  });

  const cardPersonName = useMemo(() => {
    if (!card) return '';
    return String((card.sections.find((s) => s.type === 'about')?.content as Record<string, unknown> | undefined)?.name ?? '');
  }, [card]);

  // Stable object: CardEditor resets its draft whenever `card` changes identity.
  const editorCard = useMemo(() => (card ? toEditorCard(card) : null), [card]);

  const renderPreview = (d: { templateId: string; sections: CardEditorSection[] }) =>
    card && company ? (
      <div
        className="w-[300px] max-w-full h-[612px] rounded-[40px] bg-[#0C0B0B] p-2.5 shrink-0 shadow-[0_30px_80px_rgba(0,0,0,0.55),0_0_0_1px_rgba(250,247,242,0.08)]"
        role="region"
        aria-label="Live preview of the visitor card"
      >
        <div
          className="w-full h-full rounded-[31px] overflow-hidden overflow-y-auto pointer-events-auto bg-warm-paper [scrollbar-width:none]"
          // A transform keeps the card's fixed action bar inside the phone instead of the window.
          style={{ transform: 'translateZ(0)' }}
        >
          <div
            className="pointer-events-none select-none light"
            ref={(el) => {
              if (el) el.setAttribute('inert', '');
            }}
          >
            <VisitorCard data={previewData(card, d, company)} theme="light" />
          </div>
        </div>
      </div>
    ) : null;

  const peopleList = (
    <div className="space-y-2.5">
      <div className="text-xs font-bold uppercase tracking-[0.06em] text-charcoal/50 dark:text-warm-paper/45">People</div>
      {seats.length > 6 ? (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" aria-hidden="true" />
          <label htmlFor="cards-search" className="sr-only">
            Search cards
          </label>
          <Input id="cards-search" type="search" placeholder="Search people" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 rounded-[10px] dark:bg-charcoal-deep" />
        </div>
      ) : null}
      <nav aria-label="People">
        <ul className="space-y-0.5 max-h-[264px] overflow-y-auto pr-1">
          {filtered.map((seat) => {
            const name = nameOf(seat);
            const status = summaries[seat.id]?.status;
            const selected = seat.id === selectedSeatId;
            return (
              <li key={seat.id}>
                <button
                  type="button"
                  onClick={() => setSelectedSeatId(seat.id)}
                  aria-current={selected ? 'true' : undefined}
                  className={cn(
                    'w-full flex items-center gap-2.5 min-h-[48px] px-2 rounded-[10px] text-left transition-colors',
                    selected ? 'bg-sand dark:bg-[#393536]' : 'hover:bg-sand/50 dark:hover:bg-white/5'
                  )}
                  data-testid={`cards-seat-${seat.id}`}
                >
                  <Avatar name={name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm truncate', name ? 'font-semibold' : 'opacity-60')}>{name || 'Name not added yet'}</span>
                    <span className="block text-xs opacity-60 truncate">{seat.title}</span>
                  </span>
                  {status && status !== 'published' ? (
                    <StatusChip status={status === 'pending_approval' ? 'info' : 'draft'} className="shrink-0">
                      {status === 'pending_approval' ? 'Review' : 'Draft'}
                    </StatusChip>
                  ) : null}
                </button>
              </li>
            );
          })}
          {filtered.length === 0 ? <li className="px-2 py-3 text-sm opacity-70">No one matches “{query}”.</li> : null}
        </ul>
      </nav>
    </div>
  );

  return (
    <div className={cn('space-y-6', className)} data-testid="cards-feature">
      <PageHeader
        title="Card studio"
        subtitle={cardPersonName ? `Editing ${cardPersonName} · ${card?.status === 'published' ? 'changes go live when you save' : 'publish to make the QR code work'}` : 'Choose a person to edit their card'}
        actions={
          card && card.status === 'published' ? (
            <a
              href={apiClient.publicCardUrl(card.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-[10px] border border-white/15 bg-charcoal text-sm font-bold hover:bg-[#393536]"
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              Open live card
            </a>
          ) : null
        }
      />

      {notice ? (
        <p role="status" className="px-4 py-3 rounded-[10px] border border-success/40 bg-success/10 text-sm">
          {notice}
        </p>
      ) : null}

      {listLoading ? (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]" aria-busy="true">
          <Skeleton height={420} />
          <Skeleton height={620} />
        </div>
      ) : seats.length === 0 ? (
        <p className="px-5 py-10 rounded-[14px] border border-dashed border-white/15 text-sm text-center opacity-80" data-testid="cards-empty">
          No cards yet. Add a person under People and their card appears here.
        </p>
      ) : (
        <CardEditor
          layout="studio"
          card={editorCard}
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
          peopleSlot={peopleList}
          renderPreview={renderPreview}
          brandBand={company?.brandColours?.band}
        />
      )}

      {card && renderCardExtras ? (
        <section className="rounded-[14px] border border-white/[0.08] bg-charcoal p-5 md:p-6">
          {renderCardExtras({ id: card.id, name: cardPersonName || 'this card', status: card.status })}
        </section>
      ) : null}
    </div>
  );
};
