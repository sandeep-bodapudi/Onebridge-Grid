import { Controller, Post, Body, HttpCode, HttpStatus, Optional } from '@nestjs/common';
import { TenantContext } from '@onebridge/shared';
import { MongoAnalyticsEventRepository } from '../infrastructure/mongo-analytics-event.repository.js';
import { MongoCardRepository } from '../infrastructure/mongo-card.repository.js';
import { createAnalyticsEvent, AnalyticsEventProps } from '../domain/analytics-event.js';

interface RawIncomingEvent {
  eventId?: string;
  eventType?: string;
  type?: string;
  tenantId?: string;
  cardId?: string;
  slug?: string;
  source?: string;
  sourceTag?: string;
  timestamp?: string;
  properties?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

const MAX_BATCH_SIZE = 100;

@Controller('analytics')
export class AnalyticsStubController {
  constructor(
    @Optional() private readonly analyticsRepo?: MongoAnalyticsEventRepository,
    @Optional() private readonly cardRepo?: MongoCardRepository
  ) {}

  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestEvents(@Body() body: unknown) {
    const rawList: RawIncomingEvent[] = Array.isArray(body)
      ? (body as RawIncomingEvent[])
      : body && typeof body === 'object'
        ? [body as RawIncomingEvent]
        : [];

    // DoS protection: cap batch size
    const rawEvents = rawList.slice(0, MAX_BATCH_SIZE);
    let bufferedCount = 0;

    if (this.analyticsRepo && rawEvents.length > 0) {
      for (const raw of rawEvents) {
        try {
          // Strict string type guards against NoSQL query object injection
          const safeCardId = typeof raw.cardId === 'string' && raw.cardId.trim() ? raw.cardId.trim() : undefined;
          const safeSlug = typeof raw.slug === 'string' && raw.slug.trim() ? raw.slug.trim() : undefined;
          const safeTenantId = typeof raw.tenantId === 'string' && raw.tenantId.trim() ? raw.tenantId.trim() : undefined;

          let resolvedTenantId: string | undefined;

          // Cross-tenant spoofing guard:
          // If cardId or slug is specified, the card's real tenantId in the database is authoritative.
          if (this.cardRepo && (safeCardId || safeSlug)) {
            const card = safeCardId
              ? await this.cardRepo.findByIdGlobal(safeCardId)
              : await this.cardRepo.findBySlugGlobal(safeSlug!);

            if (card) {
              resolvedTenantId = card.tenantId;
            }
          }

          // If no card was associated (e.g. edge worker scan event with verified tenantId):
          if (!resolvedTenantId && safeTenantId) {
            resolvedTenantId = safeTenantId;
          }

          if (resolvedTenantId) {
            const eventProps: AnalyticsEventProps = createAnalyticsEvent({
              eventId: typeof raw.eventId === 'string' ? raw.eventId : undefined,
              tenantId: resolvedTenantId,
              eventType: raw.eventType || raw.type || 'unknown',
              cardId: safeCardId,
              slug: safeSlug,
              source: typeof raw.source === 'string' ? raw.source : undefined,
              sourceTag: typeof raw.sourceTag === 'string' ? raw.sourceTag : undefined,
              timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : undefined,
              properties: (raw.properties || raw.metadata) as Record<string, unknown> | undefined,
            });

            await TenantContext.run(resolvedTenantId, async () => {
              await this.analyticsRepo!.save(eventProps);
            });
            bufferedCount++;
          }
        } catch {
          // Telemetry ingestion must never fail caller on individual malformed events
        }
      }
    }

    return {
      status: 'accepted',
      count: rawEvents.length,
      buffered: bufferedCount,
    };
  }
}
