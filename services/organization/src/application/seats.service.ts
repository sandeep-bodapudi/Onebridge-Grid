import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ulid } from 'ulid';
import { TenantContext, EventBus } from '@onebridge/shared';
import { MongoSeatRepository } from '../infrastructure/mongo-seat.repository.js';
import { MongoOrganizationRepository } from '../infrastructure/mongo-organization.repository.js';
import { MongoAuditRepository } from '../infrastructure/mongo-audit.repository.js';
import { CounterService } from './counter.service.js';
import {
  SeatProps,
  SeatStatus,
  CreateSeatDto,
  UpdateSeatDto,
} from '../domain/seat.js';
import { assertFieldsNotLocked } from '../domain/brand-kit.js';
import { Role } from '@onebridge/shared';

const VALID_STATUSES: SeatStatus[] = ['vacant', 'invited', 'active', 'inactive', 'offboarded'];

@Injectable()
export class SeatsService {
  constructor(
    private readonly seatRepo: MongoSeatRepository,
    private readonly orgRepo: MongoOrganizationRepository,
    private readonly counterService: CounterService,
    private readonly auditRepo: MongoAuditRepository,
    private readonly eventBus: EventBus
  ) {}

  private async getPlanSeatLimit(tenantId: string): Promise<number> {
    const org = await TenantContext.run(tenantId, () => this.orgRepo.findById(tenantId));
    const plan = org?.plan || 'starter';

    // Configurable plan limits per F17 & PLAN.md
    if (plan === 'starter') {
      return (org as unknown as { maxSeats?: number })?.maxSeats ?? 5;
    }
    if (plan === 'business') {
      return 1000;
    }
    return 100000; // enterprise
  }

  private async recordAudit(
    tenantId: string,
    entry: {
      action: string;
      entityType: string;
      entityId: string;
      actorPersonId: string;
      before?: unknown;
      after?: unknown;
    }
  ): Promise<void> {
    const now = new Date().toISOString();
    await TenantContext.run(tenantId, () =>
      this.auditRepo.record({
        id: ulid(),
        tenantId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        actorPersonId: entry.actorPersonId,
        before: entry.before as Record<string, unknown> | undefined,
        after: entry.after as Record<string, unknown> | undefined,
        occurredAt: now,
      })
    );

    await this.eventBus.publish({
      eventId: ulid(),
      type: 'audit.recorded',
      version: '1.0.0',
      tenantId,
      occurredAt: now,
      correlationId: ulid(),
      aggregateVersion: 1,
      payload: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        actorPersonId: entry.actorPersonId,
        before: entry.before,
        after: entry.after,
      },
    });
  }

  async createSeat(
    tenantId: string,
    dto: CreateSeatDto,
    actorPersonId = 'system',
    correlationId = 'unknown'
  ): Promise<SeatProps> {
    if (!dto.title || dto.title.trim() === '') {
      throw new BadRequestException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Bad Request',
        status: 400,
        detail: 'Seat title is required',
      });
    }

    if (dto.status && !VALID_STATUSES.includes(dto.status)) {
      throw new BadRequestException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Bad Request',
        status: 400,
        detail: `Invalid seat status: "${dto.status}". Allowed values: ${VALID_STATUSES.join(', ')}`,
      });
    }

    // AC-5: Derived Seat ID <BusinessID>-E<nnnn>
    const seatId = await this.counterService.generateDerivedId(tenantId, 'seat');

    // AC-4: Plan seat limits. Over-limit seats become read-only, never deleted.
    const seatLimit = await this.getPlanSeatLimit(tenantId);
    const existingCount = await TenantContext.run(tenantId, () => this.seatRepo.countSeats());
    const isReadOnly = existingCount >= seatLimit;

    // AC-6: Vacant status if created without person
    const status: SeatStatus = dto.status || (dto.personId ? 'active' : 'vacant');

    // AC-1, AC-2: Card, QR, and chip bindings
    const cardBinding = dto.cardBinding
      ? { ...dto.cardBinding }
      : {
          cardId: `card_${seatId}`,
          cardUrl: `https://onebridge.in/c/${seatId}`,
          qrCodeUrl: `https://onebridge.in/qr/${seatId}`,
        };

    const now = new Date().toISOString();
    const seat: SeatProps = {
      id: seatId,
      tenantId,
      title: dto.title.trim(),
      branchId: dto.branchId,
      departmentId: dto.departmentId,
      teamId: dto.teamId,
      managerSeatId: dto.managerSeatId,
      personId: dto.personId,
      status,
      isReadOnly,
      cardBinding,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await TenantContext.run(tenantId, () => this.seatRepo.save(seat));

    await this.recordAudit(tenantId, {
      action: 'seat.created',
      entityType: 'seat',
      entityId: seatId,
      actorPersonId,
      after: saved,
    });

    await this.eventBus.publish({
      eventId: ulid(),
      type: 'seat.created',
      version: '1.0.0',
      tenantId,
      occurredAt: now,
      correlationId,
      aggregateVersion: 1,
      payload: {
        orgId: tenantId,
        seatId,
        title: seat.title,
        personId: seat.personId,
        status: seat.status,
        branchId: seat.branchId,
        departmentId: seat.departmentId,
        teamId: seat.teamId,
      },
    });

    return saved;
  }

  async getSeat(tenantId: string, seatId: string): Promise<SeatProps> {
    const seat = await TenantContext.run(tenantId, () => this.seatRepo.findById(seatId));
    if (!seat) {
      throw new NotFoundException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Not Found',
        status: 404,
        detail: `Seat "${seatId}" not found`,
      });
    }
    return seat;
  }

  async listSeats(
    tenantId: string,
    options?: {
      status?: string;
      branchId?: string;
      departmentId?: string;
      teamId?: string;
    },
    limit = 50,
    offset = 0
  ): Promise<{ items: SeatProps[]; total: number; limit: number; offset: number }> {
    const all = await TenantContext.run(tenantId, () => this.seatRepo.listSeats(options));
    const items = all.slice(offset, offset + limit);
    return {
      items,
      total: all.length,
      limit,
      offset,
    };
  }

  async updateSeat(
    tenantId: string,
    seatId: string,
    dto: UpdateSeatDto,
    actorPersonId = 'system',
    correlationId = 'unknown',
    callerRole?: Role | string
  ): Promise<SeatProps> {
    const existing = await this.getSeat(tenantId, seatId);

    // AC-4: Over-limit seats become read-only, never deleted.
    if (existing.isReadOnly) {
      throw new ForbiddenException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: 'Seat is read-only because organization exceeds its plan seat limit. Upgrade to edit.',
      });
    }

    // Role and field-level lock validation
    const normalizedRole = callerRole ? (callerRole as string).toLowerCase() : undefined;
    const isOwnerOrAdmin = normalizedRole === 'owner' || normalizedRole === 'admin';
    if (!isOwnerOrAdmin && normalizedRole !== undefined) {
      if (normalizedRole !== 'employee' || existing.personId !== actorPersonId) {
        throw new ForbiddenException({
          type: 'https://tools.ietf.org/html/rfc7807',
          title: 'Forbidden',
          status: 403,
          detail: 'Only Organization Owner, Admin, or the assigned employee can edit this seat',
          correlationId,
        });
      }

      // Check field-level locks for employees
      const org = await TenantContext.run(tenantId, () => this.orgRepo.findById(tenantId));
      if (org?.fieldLocks) {
        assertFieldsNotLocked(org.fieldLocks, dto as Record<string, unknown>, normalizedRole, correlationId);
      }
    }

    if (dto.status && !VALID_STATUSES.includes(dto.status)) {
      throw new BadRequestException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Bad Request',
        status: 400,
        detail: `Invalid seat status: "${dto.status}"`,
      });
    }

    const previousStatus = existing.status;
    const now = new Date().toISOString();
    const updated: SeatProps = {
      ...existing,
      title: dto.title !== undefined ? dto.title.trim() : existing.title,
      branchId: dto.branchId !== undefined ? dto.branchId : existing.branchId,
      departmentId: dto.departmentId !== undefined ? dto.departmentId : existing.departmentId,
      teamId: dto.teamId !== undefined ? dto.teamId : existing.teamId,
      managerSeatId: dto.managerSeatId !== undefined ? dto.managerSeatId : existing.managerSeatId,
      status: dto.status !== undefined ? dto.status : existing.status,
      cardBinding: existing.cardBinding,
      updatedAt: now,
    };

    const saved = await TenantContext.run(tenantId, () => this.seatRepo.save(updated));

    await this.recordAudit(tenantId, {
      action: 'seat.updated',
      entityType: 'seat',
      entityId: seatId,
      actorPersonId,
      before: existing,
      after: saved,
    });

    await this.eventBus.publish({
      eventId: ulid(),
      type: 'seat.updated',
      version: '1.0.0',
      tenantId,
      occurredAt: now,
      correlationId,
      aggregateVersion: 1,
      payload: {
        orgId: tenantId,
        seatId,
        updatedFields: dto,
      },
    });

    if (saved.status !== previousStatus) {
      await this.eventBus.publish({
        eventId: ulid(),
        type: 'seat.status_changed',
        version: '1.0.0',
        tenantId,
        occurredAt: now,
        correlationId,
        aggregateVersion: 1,
        payload: {
          orgId: tenantId,
          seatId,
          previousStatus,
          newStatus: saved.status,
        },
      });
    }

    return saved;
  }

  async assignSeat(
    tenantId: string,
    seatId: string,
    dto: { personId: string },
    actorPersonId = 'system',
    correlationId = 'unknown'
  ): Promise<SeatProps> {
    const existing = await this.getSeat(tenantId, seatId);

    // AC-4: Over-limit seats are read-only
    if (existing.isReadOnly) {
      throw new ForbiddenException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: 'Seat is read-only because organization exceeds its plan seat limit. Upgrade to edit.',
      });
    }

    if (!dto.personId || dto.personId.trim() === '') {
      throw new BadRequestException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Bad Request',
        status: 400,
        detail: 'personId is required for seat assignment',
      });
    }

    const previousPersonId = existing.personId;
    const now = new Date().toISOString();

    // AC-2: Reassigning a seat to another person keeps the card URL, QR, NFC binding, analytics history and leads.
    const updated: SeatProps = {
      ...existing,
      personId: dto.personId.trim(),
      // F14: a claimed invite ("invited") becomes active too.
      status: (existing.status === 'vacant' || existing.status === 'offboarded' || existing.status === 'invited') ? 'active' : existing.status,
      // cardBinding strictly preserved
      cardBinding: existing.cardBinding,
      updatedAt: now,
    };

    const saved = await TenantContext.run(tenantId, () => this.seatRepo.save(updated));

    await this.recordAudit(tenantId, {
      action: 'seat.assigned',
      entityType: 'seat',
      entityId: seatId,
      actorPersonId,
      before: existing,
      after: saved,
    });

    await this.eventBus.publish({
      eventId: ulid(),
      type: 'seat.assigned',
      version: '1.0.0',
      tenantId,
      occurredAt: now,
      correlationId,
      aggregateVersion: 1,
      payload: {
        orgId: tenantId,
        seatId,
        previousPersonId,
        personId: saved.personId,
        bindingsPreserved: true,
      },
    });

    if (saved.status !== existing.status) {
      await this.eventBus.publish({
        eventId: ulid(),
        type: 'seat.status_changed',
        version: '1.0.0',
        tenantId,
        occurredAt: now,
        correlationId,
        aggregateVersion: 1,
        payload: {
          orgId: tenantId,
          seatId,
          previousStatus: existing.status,
          newStatus: saved.status,
        },
      });
    }

    return saved;
  }

  async archiveSeat(
    tenantId: string,
    seatId: string,
    actorPersonId = 'system',
    correlationId = 'unknown'
  ): Promise<SeatProps> {
    const existing = await this.getSeat(tenantId, seatId);
    if (existing.status === 'offboarded') {
      return existing;
    }

    const previousStatus = existing.status;
    const now = new Date().toISOString();
    const updated: SeatProps = {
      ...existing,
      status: 'offboarded',
      updatedAt: now,
    };

    const saved = await TenantContext.run(tenantId, () => this.seatRepo.save(updated));

    await this.recordAudit(tenantId, {
      action: 'seat.archived',
      entityType: 'seat',
      entityId: seatId,
      actorPersonId,
      before: existing,
      after: saved,
    });

    await this.eventBus.publish({
      eventId: ulid(),
      type: 'seat.status_changed',
      version: '1.0.0',
      tenantId,
      occurredAt: now,
      correlationId,
      aggregateVersion: 1,
      payload: {
        orgId: tenantId,
        seatId,
        previousStatus,
        newStatus: 'offboarded',
      },
    });

    return saved;
  }
}
