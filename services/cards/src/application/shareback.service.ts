import { ulid } from 'ulid';
import {
  TenantContext,
  PublishableEventBus,
  KeyVaultProvider,
  RateLimiter,
  normalizePhoneToE164,
  computePhoneBlindIndex,
  encryptLeadPayload,
} from '@onebridge/shared';
import { MongoCardRepository } from '../infrastructure/mongo-card.repository.js';
import { MongoLeadRepository } from '../infrastructure/mongo-lead.repository.js';
import { Lead, ConsentRequiredError, LeadSource } from '../domain/lead.js';
import { TurnstileValidator } from './turnstile-validator.js';
import { LeadNotifier } from '../domain/notifier.js';

export class CardNotFoundError extends Error {
  constructor(message = 'Card not found or inactive') {
    super(message);
    this.name = 'CardNotFoundError';
  }
}

export class RateLimitExceededError extends Error {
  constructor(public readonly retryAfterSeconds: number, message = 'Rate limit exceeded. Please try again later.') {
    super(message);
    this.name = 'RateLimitExceededError';
  }
}

export class TurnstileVerificationFailedError extends Error {
  constructor(message = 'Turnstile verification failed') {
    super(message);
    this.name = 'TurnstileVerificationFailedError';
  }
}

export class InvalidSharebackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSharebackError';
  }
}

export interface SubmitSharebackInput {
  slug: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  note?: string;
  consent: boolean;
  noticeVersion?: string;
  source?: LeadSource;
  sourceTag?: string;
  turnstileToken?: string;
  clientIp?: string;
}

export interface SubmitSharebackOutput {
  leadId: string;
  cardId: string;
  status: 'created' | 'duplicate';
  message: string;
  createdAt: string;
}

export class SharebackService {
  constructor(
    private readonly cardRepo: MongoCardRepository,
    private readonly leadRepo: MongoLeadRepository,
    private readonly keyVault: KeyVaultProvider,
    private readonly rateLimiter: RateLimiter,
    private readonly turnstileValidator: TurnstileValidator,
    private readonly eventBus: PublishableEventBus,
    private readonly notifier: LeadNotifier
  ) {}

  async submitShareback(input: SubmitSharebackInput): Promise<SubmitSharebackOutput> {
    // 1. Validate fields
    if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
      throw new InvalidSharebackError('Name is required');
    }
    if (input.consent !== true) {
      throw new ConsentRequiredError();
    }

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneToE164(input.phone);
    } catch {
      throw new InvalidSharebackError('Valid phone number is required');
    }

    if (input.email !== undefined && input.email !== null) {
      const emailTrimmed = String(input.email).trim();
      if (emailTrimmed.length > 0) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailTrimmed)) {
          throw new InvalidSharebackError('Valid email address is required');
        }
      }
    }

    // 2. Find public card by slug
    const card = await this.cardRepo.findBySlugGlobal(input.slug);
    if (!card || card.status !== 'published') {
      throw new CardNotFoundError();
    }

    const clientIp = input.clientIp || '127.0.0.1';

    // 3. Spam protection: Turnstile
    const isTurnstileValid = await this.turnstileValidator.validateToken(input.turnstileToken, clientIp);
    if (!isTurnstileValid) {
      throw new TurnstileVerificationFailedError();
    }

    // 4. Rate limiting per IP (5 per 15 min) and per Card (20 per hour)
    const ipLimit = this.rateLimiter.consume(`ip:${clientIp}`, {
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!ipLimit.allowed) {
      const retryAfter = Math.ceil((ipLimit.retryAfterMs || 60000) / 1000);
      throw new RateLimitExceededError(retryAfter);
    }

    const cardLimit = this.rateLimiter.consume(`card:${card.id}`, {
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (!cardLimit.allowed) {
      const retryAfter = Math.ceil((cardLimit.retryAfterMs || 60000) / 1000);
      throw new RateLimitExceededError(retryAfter);
    }

    // 5. Blind index for duplicate detection
    const indexKey = await this.keyVault.getIndexKey();
    const phoneBlindIndex = computePhoneBlindIndex({
      indexKey,
      tenantId: card.tenantId,
      phone: normalizedPhone,
    });

    return TenantContext.run(card.tenantId, async () => {
      const ownerSeatId =
        card.ownerId ||
        ('seatId' in card && typeof (card as { seatId?: unknown }).seatId === 'string'
          ? (card as { seatId: string }).seatId
          : card.id);

      // 6. Duplicate check within 24 hours per ADR-0002 point 5
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existing = await this.leadRepo.findRecentByBlindIndex(
        card.id,
        phoneBlindIndex,
        twentyFourHoursAgo
      );

      if (existing) {
        // Return original confirmation without creating second lead and do not notify twice
        await this.eventBus.publish({
          eventId: ulid(),
          type: 'shareback.submitted',
          version: '1.0.0',
          tenantId: card.tenantId,
          occurredAt: new Date().toISOString(),
          correlationId: ulid(),
          aggregateVersion: 1,
          payload: {
            leadId: existing.id,
            cardId: card.id,
            ownerSeatId,
            source: input.source || 'shareback',
            sourceTag: input.sourceTag,
            isDuplicate: true,
            consent: {
              timestamp: existing.consent.timestamp,
              noticeVersion: existing.consent.noticeVersion,
            },
          },
        });

        return {
          leadId: existing.id,
          cardId: card.id,
          status: 'duplicate',
          message: 'Details already received. Thank you!',
          createdAt: existing.createdAt.toISOString(),
        };
      }

      // 7. Create new lead with encrypted payload
      const leadId = ulid();
      const { kid, key } = await this.keyVault.getTenantKey(card.tenantId);

      const encryptedPayload = encryptLeadPayload({
        payload: {
          name: input.name.trim(),
          phone: normalizedPhone,
          email: input.email ? input.email.trim() : undefined,
          company: input.company ? input.company.trim() : undefined,
          note: input.note ? input.note.trim() : undefined,
        },
        key,
        kid,
        tenantId: card.tenantId,
        leadId,
      });

      const noticeVersion = input.noticeVersion || 'v1.0';
      const consentTimestamp = new Date().toISOString();

      const lead = Lead.create({
        id: leadId,
        tenantId: card.tenantId,
        cardId: card.id,
        ownerSeatId,
        source: input.source || 'shareback',
        sourceTag: input.sourceTag,
        encryptedPayload,
        phoneBlindIndex,
        indexVersion: 1,
        consent: {
          granted: true,
          timestamp: consentTimestamp,
          noticeVersion,
          cardId: card.id,
        },
      });

      await this.leadRepo.save(lead.toProps());

      // 8. Publish domain events (NO visitor PII!)
      await this.eventBus.publish({
        eventId: ulid(),
        type: 'shareback.submitted',
        version: '1.0.0',
        tenantId: card.tenantId,
        occurredAt: new Date().toISOString(),
        correlationId: ulid(),
        aggregateVersion: 1,
        payload: {
          leadId,
          cardId: card.id,
          ownerSeatId,
          source: input.source || 'shareback',
          sourceTag: input.sourceTag,
          isDuplicate: false,
          consent: {
            timestamp: consentTimestamp,
            noticeVersion,
          },
        },
      });

      await this.eventBus.publish({
        eventId: ulid(),
        type: 'lead.created',
        version: '1.0.0',
        tenantId: card.tenantId,
        occurredAt: new Date().toISOString(),
        correlationId: ulid(),
        aggregateVersion: 1,
        payload: {
          leadId,
          cardId: card.id,
          ownerSeatId,
          source: input.source || 'shareback',
          sourceTag: input.sourceTag,
          createdAt: lead.createdAt.toISOString(),
        },
      });

      // 9. Notify owner in under 10 seconds
      await this.notifier.notifyOwner({
        tenantId: card.tenantId,
        ownerSeatId,
        cardId: card.id,
        leadId,
        source: input.source || 'shareback',
        sourceTag: input.sourceTag,
        timestamp: lead.createdAt,
      });

      return {
        leadId,
        cardId: card.id,
        status: 'created',
        message: 'Details shared successfully',
        createdAt: lead.createdAt.toISOString(),
      };
    });
  }
}
