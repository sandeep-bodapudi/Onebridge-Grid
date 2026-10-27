import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { ulid } from 'ulid';
import { EventBus, KeyVaultProvider, TenantContext } from '@onebridge/shared';
import {
  INVITE_CHANNELS,
  INVITE_TTL_DAYS,
  InviteChannel,
  InviteProps,
  InvalidInviteError,
  SEAT_NOTICE,
  contactIndex,
  decryptContact,
  effectiveStatus,
  encryptContact,
  generateInviteToken,
  hashInviteToken,
  maskContact,
  normaliseContact,
} from '../domain/invite.js';
import { SeatProps } from '../domain/seat.js';
import { MongoInviteRepository, MongoNoticeAcceptanceRepository } from '../infrastructure/mongo-invite.repository.js';
import { MongoSeatRepository } from '../infrastructure/mongo-seat.repository.js';
import { MongoOrganizationRepository } from '../infrastructure/mongo-organization.repository.js';
import { MongoAuditRepository } from '../infrastructure/mongo-audit.repository.js';
import { IdentityInternalClient } from '../infrastructure/identity-internal.client.js';
import { InviteNotifier } from '../infrastructure/invite-notifier.js';
import { SeatsService } from './seats.service.js';

const DAY_MS = 86_400_000;

const problem = (status: number, title: string, detail: string, code?: string) => ({
  type: 'https://tools.ietf.org/html/rfc7807',
  title,
  status,
  detail,
  ...(code ? { code } : {}),
});

export interface InviteSummary {
  inviteId: string;
  seatId: string;
  channel: InviteChannel;
  contactMasked: string;
  status: InviteProps['status'];
  expiresAt: string;
  sentCount: number;
  lastSentAt: string;
  /** Only while invites are not delivered for real (fake notifier, never in production). */
  inviteUrl?: string;
}

export interface InvitePreview {
  status: 'pending' | 'claimed' | 'revoked' | 'expired' | 'invalid';
  companyName?: string;
  companyLogo?: string;
  seatTitle?: string;
  channel?: InviteChannel;
  contactMasked?: string;
  expiresAt?: string;
  notice?: { version: string; en: { title: string; points: string[]; accept: string; decline: string }; hi: { title: string; points: string[]; accept: string; decline: string } };
}

export interface ClaimResult {
  tenantId: string;
  seatId: string;
  cardId: string;
  companyName: string;
}

/**
 * F14: invite people into seats and let them claim the seat.
 */
export class InviteService {
  constructor(
    private readonly inviteRepo: MongoInviteRepository,
    private readonly noticeRepo: MongoNoticeAcceptanceRepository,
    private readonly seatRepo: MongoSeatRepository,
    private readonly seatsService: SeatsService,
    private readonly orgRepo: MongoOrganizationRepository,
    private readonly auditRepo: MongoAuditRepository,
    private readonly identityClient: IdentityInternalClient,
    private readonly keyVault: KeyVaultProvider,
    private readonly notifier: InviteNotifier,
    private readonly eventBus: EventBus,
    /** Admin app origin; invite links open <appUrl>/invite/<token>. */
    private readonly appUrl: string,
    /** Return the link to the admin when invites are not delivered for real (never in production). */
    private readonly exposeLinksWhenFake: boolean,
    private readonly now: () => Date = () => new Date(),
    /** D-AUTH-EMAIL D11: phone sign-in is off (production), so invitees must be reached and sign in by email. */
    private readonly emailOnly = false
  ) {}

  private inviteUrl(token: string): string {
    return `${this.appUrl.replace(/\/+$/, '')}/invite/${token}`;
  }

  private summary(invite: InviteProps, token?: string): InviteSummary {
    return {
      inviteId: invite.id,
      seatId: invite.seatId,
      channel: invite.channel,
      contactMasked: invite.contactMasked,
      status: effectiveStatus(invite, this.now()),
      expiresAt: invite.expiresAt,
      sentCount: invite.sentCount,
      lastSentAt: invite.lastSentAt,
      ...(token && !this.notifier.deliversForReal && this.exposeLinksWhenFake ? { inviteUrl: this.inviteUrl(token) } : {}),
    };
  }

  private async audit(tenantId: string, action: string, entityId: string, actorPersonId: string, after?: Record<string, unknown>): Promise<void> {
    const occurredAt = this.now().toISOString();
    await TenantContext.run(tenantId, () =>
      this.auditRepo.record({ id: ulid(), tenantId, action, entityType: 'seat', entityId, actorPersonId, after, occurredAt })
    );
    await this.eventBus.publish({
      eventId: ulid(),
      type: 'audit.recorded',
      version: '1.0.0',
      tenantId,
      occurredAt,
      correlationId: ulid(),
      aggregateVersion: 1,
      payload: { action, entityType: 'seat', entityId, actorPersonId, after },
    });
  }

  private async setSeatStatus(tenantId: string, seat: SeatProps, status: SeatProps['status'], correlationId: string): Promise<void> {
    if (seat.status === status) return;
    const occurredAt = this.now().toISOString();
    await TenantContext.run(tenantId, () => this.seatRepo.save({ ...seat, status, updatedAt: occurredAt }));
    await this.eventBus.publish({
      eventId: ulid(),
      type: 'seat.status_changed',
      version: '1.0.0',
      tenantId,
      occurredAt,
      correlationId,
      aggregateVersion: 1,
      payload: { orgId: tenantId, seatId: seat.id, previousStatus: seat.status, newStatus: status },
    });
  }

  /** POST /orgs/{tenantId}/seats/{seatId}/invite: send (or resend with a fresh link) an invite. */
  async invite(
    tenantId: string,
    seatId: string,
    input: { channel?: unknown; contact?: unknown },
    actorPersonId: string,
    correlationId = 'unknown'
  ): Promise<InviteSummary> {
    const channel = input.channel as InviteChannel;
    if (!INVITE_CHANNELS.includes(channel)) {
      throw new BadRequestException(problem(400, 'Bad Request', this.emailOnly ? 'Send the invite by email.' : 'Choose SMS, WhatsApp or email.'));
    }
    if (this.emailOnly && channel !== 'email') {
      throw new BadRequestException(
        problem(400, 'Bad Request', 'Send the invite by email. People sign in to OneBridge with their email address, so the invite has to reach it.', 'email_required')
      );
    }
    const seat = await this.seatsService.getSeat(tenantId, seatId);
    if (seat.isReadOnly) {
      throw new ForbiddenException(
        problem(403, 'Over the plan limit', 'This seat is over your plan’s seat limit. Upgrade your plan to invite someone to it.', 'over_limit')
      );
    }
    if (seat.status === 'active' && seat.personId) {
      throw new ConflictException(problem(409, 'Seat taken', 'This seat already has a person. Offboard them before inviting someone else.', 'seat_taken'));
    }
    if (seat.status === 'offboarded' || seat.status === 'inactive') {
      throw new ConflictException(problem(409, 'Seat closed', 'This seat is closed. Reopen it before inviting someone.', 'seat_closed'));
    }

    let normalised: string;
    try {
      normalised = normaliseContact(channel, input.contact);
    } catch (err) {
      throw new BadRequestException(problem(400, 'Bad Request', err instanceof InvalidInviteError ? err.message : 'Enter a valid contact.'));
    }

    return TenantContext.run(tenantId, async () => {
      const now = this.now();
      // A new invite replaces any pending one: the old link stops working.
      const previous = await this.inviteRepo.findPendingBySeat(seatId);
      if (previous) await this.inviteRepo.save({ ...previous, status: 'revoked', revokedAt: now.toISOString() });

      const id = ulid();
      const { token, tokenHash } = generateInviteToken();
      const [{ kid, key }, indexKey, org] = await Promise.all([
        this.keyVault.getTenantKey(tenantId),
        this.keyVault.getIndexKey(),
        this.orgRepo.findById(tenantId),
      ]);
      const invite: InviteProps = {
        id,
        tenantId,
        seatId,
        tokenHash,
        channel,
        contactEncrypted: encryptContact(key, kid, tenantId, id, normalised),
        contactMasked: maskContact(channel, normalised),
        contactIndex: contactIndex(indexKey, tenantId, normalised),
        status: 'pending',
        expiresAt: new Date(now.getTime() + INVITE_TTL_DAYS * DAY_MS).toISOString(),
        createdAt: now.toISOString(),
        createdBy: actorPersonId,
        sentCount: (previous?.sentCount ?? 0) + 1,
        lastSentAt: now.toISOString(),
      };
      await this.inviteRepo.save(invite);
      await this.setSeatStatus(tenantId, seat, 'invited', correlationId);
      await this.notifier.send({
        channel,
        to: normalised,
        companyName: org?.name ?? 'Your company',
        seatTitle: seat.title,
        inviteUrl: this.inviteUrl(token),
        expiresAt: invite.expiresAt,
      });
      await this.audit(tenantId, previous ? 'seat.invite_resent' : 'seat.invited', seatId, actorPersonId, {
        channel,
        contactMasked: invite.contactMasked,
        expiresAt: invite.expiresAt,
      });
      return this.summary(invite, token);
    });
  }

  /** POST /orgs/{tenantId}/seats/{seatId}/invite/revoke */
  async revoke(tenantId: string, seatId: string, actorPersonId: string, correlationId = 'unknown'): Promise<InviteSummary> {
    const seat = await this.seatsService.getSeat(tenantId, seatId);
    return TenantContext.run(tenantId, async () => {
      const pending = await this.inviteRepo.findPendingBySeat(seatId);
      if (!pending) throw new NotFoundException(problem(404, 'Not Found', 'This seat has no open invite.'));
      const revoked: InviteProps = { ...pending, status: 'revoked', revokedAt: this.now().toISOString() };
      await this.inviteRepo.save(revoked);
      if (seat.status === 'invited') await this.setSeatStatus(tenantId, seat, 'vacant', correlationId);
      await this.audit(tenantId, 'seat.invite_revoked', seatId, actorPersonId, { contactMasked: pending.contactMasked });
      return this.summary(revoked);
    });
  }

  /** GET /orgs/{tenantId}/invites: open invites, for the people list. */
  async listPending(tenantId: string): Promise<InviteSummary[]> {
    return TenantContext.run(tenantId, async () => (await this.inviteRepo.listPending()).map((i) => this.summary(i)));
  }

  /** GET /invites/{token}: minimal data, and none at all unless the invite is open. */
  async preview(token: string): Promise<InvitePreview> {
    const invite = typeof token === 'string' && token.length >= 20 ? await this.inviteRepo.findByTokenHashGlobal(hashInviteToken(token)) : null;
    if (!invite) return { status: 'invalid' };
    const status = effectiveStatus(invite, this.now());
    if (status !== 'pending') return { status };
    return TenantContext.run(invite.tenantId, async () => {
      const [org, seat] = await Promise.all([this.orgRepo.findById(invite.tenantId), this.seatRepo.findById(invite.seatId)]);
      const company = org?.name ?? 'your company';
      const fill = (text: string) => text.replace(/\{company\}/g, company);
      return {
        status,
        companyName: org?.name,
        companyLogo: (org as unknown as { logo?: string } | null)?.logo,
        seatTitle: seat?.title,
        channel: invite.channel,
        contactMasked: invite.contactMasked,
        expiresAt: invite.expiresAt,
        notice: {
          version: SEAT_NOTICE.version,
          en: { ...SEAT_NOTICE.en, points: SEAT_NOTICE.en.points.map(fill) },
          hi: { ...SEAT_NOTICE.hi, points: SEAT_NOTICE.hi.points.map(fill) },
        },
      };
    });
  }

  /**
   * POST /invites/{token}/claim by the signed-in invitee. The person must have
   * verified the phone or email the invite was sent to (OTP at sign-in) and
   * accept the current privacy notice (F14 AC-2).
   */
  async claim(
    token: string,
    personId: string,
    input: { acceptNotice?: unknown; noticeVersion?: unknown },
    correlationId = 'unknown'
  ): Promise<ClaimResult> {
    const invite = typeof token === 'string' && token.length >= 20 ? await this.inviteRepo.findByTokenHashGlobal(hashInviteToken(token)) : null;
    if (!invite) throw new NotFoundException(problem(404, 'Not Found', 'This invite link is not valid.', 'invalid'));
    const status = effectiveStatus(invite, this.now());
    if (status !== 'pending') {
      const detail =
        status === 'claimed'
          ? 'This invite has already been used.'
          : status === 'revoked'
            ? 'This invite was cancelled. Ask your admin for a new one.'
            : 'This invite has expired. Ask your admin to send a new one.';
      throw new GoneException(problem(410, 'Gone', detail, status));
    }

    const { tenantId } = invite;
    return TenantContext.run(tenantId, async () => {
      // Wrong person: the signed-in person's verified contact must match the invite.
      const contacts = await this.identityClient.getPersonContacts(personId);
      const indexKey = await this.keyVault.getIndexKey();
      const candidate = invite.channel === 'email' ? contacts?.email : contacts?.phone;
      let matches = false;
      if (candidate) {
        try {
          matches = contactIndex(indexKey, tenantId, normaliseContact(invite.channel, candidate)) === invite.contactIndex;
        } catch {
          matches = false;
        }
      }
      if (!matches) {
        throw new ForbiddenException(
          problem(
            403,
            'Forbidden',
            `Sign in with the ${invite.channel === 'email' ? 'email address' : 'mobile number'} this invite was sent to (${invite.contactMasked}).`,
            'wrong_person'
          )
        );
      }

      if (input.acceptNotice !== true || input.noticeVersion !== SEAT_NOTICE.version) {
        throw new BadRequestException(problem(400, 'Bad Request', 'Accept the notice to claim this card.', 'notice_required'));
      }

      // Single use: only one claim can move the invite out of "pending".
      const claimedAt = this.now().toISOString();
      const won = await this.inviteRepo.markClaimed(invite.id, personId, claimedAt);
      if (!won) throw new GoneException(problem(410, 'Gone', 'This invite has already been used.', 'claimed'));

      await this.noticeRepo.record({
        id: ulid(),
        tenantId,
        personId,
        seatId: invite.seatId,
        inviteId: invite.id,
        version: SEAT_NOTICE.version,
        acceptedAt: claimedAt,
      });

      // Access to the company (never lowers an existing owner or admin role).
      await this.identityClient.createMembership({
        personId,
        orgId: tenantId,
        role: 'employee',
        onlyIfAbsent: true,
        idempotencyKey: `claim-${invite.id}`,
        correlationId,
      });

      // seat.assigned: the seat (and its card, QR and leads) now has this person.
      await this.seatsService.assignSeat(tenantId, invite.seatId, { personId }, personId, correlationId);
      await this.audit(tenantId, 'seat.claimed', invite.seatId, personId, { noticeVersion: SEAT_NOTICE.version, channel: invite.channel });

      const org = await this.orgRepo.findById(tenantId);
      return { tenantId, seatId: invite.seatId, cardId: invite.seatId, companyName: org?.name ?? '' };
    });
  }

  /** For resend flows that keep the same contact: the admin never sees the full value. */
  async contactFor(tenantId: string, invite: InviteProps): Promise<string> {
    const key = await this.keyVault.getKeyByKid(invite.contactEncrypted.kid);
    return decryptContact(key, tenantId, invite.id, invite.contactEncrypted);
  }

  /** POST /orgs/{tenantId}/seats/{seatId}/invite/resend: a fresh link to the same contact. */
  async resend(tenantId: string, seatId: string, actorPersonId: string, correlationId = 'unknown'): Promise<InviteSummary> {
    const pending = await TenantContext.run(tenantId, () => this.inviteRepo.findPendingBySeat(seatId));
    // An expired invite can be resent too: look for the latest one when nothing is pending.
    const latest = pending ?? (await TenantContext.run(tenantId, () => this.inviteRepo.findLatestBySeat(seatId)));
    if (!latest || latest.status === 'claimed') {
      throw new NotFoundException(problem(404, 'Not Found', 'This seat has no invite to resend.'));
    }
    const contact = await this.contactFor(tenantId, latest);
    return this.invite(tenantId, seatId, { channel: latest.channel, contact }, actorPersonId, correlationId);
  }
}
