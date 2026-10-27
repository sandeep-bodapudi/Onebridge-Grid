import { BadRequestException, ForbiddenException, HttpException, NotFoundException } from '@nestjs/common';
import { ulid } from 'ulid';
import type { EventBus } from '@onebridge/shared';
import type { ActorSummary } from '@onebridge/api-contracts';
import { ActorType, CompanyRef, FollowProps, MongoCompanyRefRepository, MongoFollowRepository } from '../infrastructure/repositories.js';
import { ProfilesClient } from '../infrastructure/profiles-client.js';

export interface Actor {
  type: ActorType;
  id: string;
}

const SOURCES = ['profile', 'search', 'card_scan', 'post', 'other'];
const PAGE = 50;

const problem = (status: number, title: string, detail: string, code?: string) => ({
  type: 'https://tools.ietf.org/html/rfc7807',
  title,
  status,
  detail,
  ...(code ? { code } : {}),
});

function companySummary(ref: CompanyRef): ActorSummary {
  return {
    type: 'company',
    id: ref.tenantId,
    handle: ref.slug,
    name: ref.name,
    headline: [ref.industry, ref.city].filter(Boolean).join(' · ') || undefined,
    photoUrl: ref.logo,
    verified: ref.verified,
  };
}

/**
 * N04: members and companies follow members and companies. Follow edges
 * never carry personal data; lists are built from public summaries.
 */
export class FollowService {
  constructor(
    private readonly follows: MongoFollowRepository,
    private readonly companies: MongoCompanyRefRepository,
    private readonly profiles: ProfilesClient,
    private readonly eventBus: EventBus,
    private readonly dailyCap: number,
    private readonly now: () => Date = () => new Date()
  ) {}

  private validateType(type: string): ActorType {
    if (type !== 'member' && type !== 'company') throw new BadRequestException(problem(400, 'Bad Request', 'You can follow a member or a company.'));
    return type;
  }

  private async assertExists(target: Actor): Promise<void> {
    const found =
      target.type === 'company'
        ? Boolean(await this.companies.get(target.id))
        : (await this.profiles.summaries([target.id])).some((m) => m.personId === target.id);
    if (!found) throw new NotFoundException(problem(404, 'Not Found', 'No such member or company.'));
  }

  private async publish(type: string, payload: Record<string, unknown>): Promise<void> {
    await this.eventBus.publish({
      eventId: ulid(),
      type,
      version: '1.0.0',
      tenantId: 'global',
      occurredAt: this.now().toISOString(),
      correlationId: ulid(),
      aggregateVersion: 1,
      payload,
    });
  }

  async state(viewer: Actor | null, targetTypeRaw: string, targetId: string) {
    const target: Actor = { type: this.validateType(targetTypeRaw), id: targetId };
    await this.assertExists(target);
    const [followerCount, following] = await Promise.all([
      this.follows.countFollowers(target.type, target.id),
      viewer ? this.follows.exists(viewer.type, viewer.id, target.type, target.id) : Promise.resolve(false),
    ]);
    return { following, followerCount };
  }

  /** PUT /follows/{type}/{id}: idempotent. */
  async follow(actor: Actor, targetTypeRaw: string, targetId: string, sourceRaw?: string) {
    const target: Actor = { type: this.validateType(targetTypeRaw), id: targetId };
    if (actor.type === target.type && actor.id === target.id) {
      throw new BadRequestException(problem(400, 'Bad Request', 'You cannot follow yourself.', 'self_follow'));
    }
    await this.assertExists(target);
    if (!(await this.follows.exists(actor.type, actor.id, target.type, target.id))) {
      const dayStart = new Date(Date.UTC(this.now().getUTCFullYear(), this.now().getUTCMonth(), this.now().getUTCDate())).toISOString();
      if ((await this.follows.countFollowsSince(actor.type, actor.id, dayStart)) >= this.dailyCap) {
        throw new HttpException(
          { ...problem(429, 'Too Many Requests', 'You have followed a lot of accounts today. Try again tomorrow.', 'rate_limited'), retryAfterSeconds: 3600 },
          429
        );
      }
      const source = sourceRaw && SOURCES.includes(sourceRaw) ? sourceRaw : 'other';
      const edge: FollowProps = {
        id: ulid(),
        followerType: actor.type,
        followerId: actor.id,
        targetType: target.type,
        targetId: target.id,
        source,
        createdAt: this.now().toISOString(),
      };
      if (await this.follows.add(edge)) {
        await this.publish('follow.created', { followerType: actor.type, followerId: actor.id, targetType: target.type, targetId: target.id, source });
      }
    }
    return { following: true, followerCount: await this.follows.countFollowers(target.type, target.id) };
  }

  /** DELETE /follows/{type}/{id}: idempotent. */
  async unfollow(actor: Actor, targetTypeRaw: string, targetId: string) {
    const target: Actor = { type: this.validateType(targetTypeRaw), id: targetId };
    if (await this.follows.remove(actor.type, actor.id, target.type, target.id)) {
      await this.publish('follow.removed', { followerType: actor.type, followerId: actor.id, targetType: target.type, targetId: target.id });
    }
    return { following: false, followerCount: await this.follows.countFollowers(target.type, target.id) };
  }

  private async summarise(actors: Actor[]): Promise<ActorSummary[]> {
    const memberIds = actors.filter((a) => a.type === 'member').map((a) => a.id);
    const companyIds = actors.filter((a) => a.type === 'company').map((a) => a.id);
    const [members, companies] = await Promise.all([this.profiles.summaries(memberIds), this.companies.getMany(companyIds)]);
    const memberMap = new Map(members.map((m) => [m.personId, m]));
    const companyMap = new Map(companies.map((c) => [c.tenantId, c]));
    // Accounts without a profile (or a deleted one) are left out of lists.
    return actors.flatMap((a): ActorSummary[] => {
      if (a.type === 'company') {
        const ref = companyMap.get(a.id);
        return ref ? [companySummary(ref)] : [];
      }
      const m = memberMap.get(a.id);
      return m ? [{ type: 'member', id: m.personId, handle: m.handle, name: m.name, headline: m.headline, photoUrl: m.photoUrl, verified: false }] : [];
    });
  }

  private async pageOf(edges: FollowProps[], pick: (e: FollowProps) => Actor, total: number) {
    const items = await this.summarise(edges.map(pick));
    const last = edges[edges.length - 1];
    return { items, total, ...(edges.length === PAGE && last ? { nextCursor: `${last.createdAt}|${last.id}` } : {}) };
  }

  /** GET /companies/{id}/followers: Owner and Admins of that company only. */
  async companyFollowers(companyId: string, callerRole: string | undefined, cursor?: string) {
    if (callerRole !== 'owner' && callerRole !== 'admin') {
      throw new ForbiddenException(problem(403, 'Forbidden', 'Only the company owner or an admin can see its followers.'));
    }
    const edges = await this.follows.listFollowers('company', companyId, PAGE, cursor);
    return this.pageOf(edges, (e) => ({ type: e.followerType, id: e.followerId }), await this.follows.countFollowers('company', companyId));
  }

  /** GET /members/{personId}/followers: signed-in members (N10 will let members hide the list). */
  async memberFollowers(personId: string, cursor?: string) {
    const edges = await this.follows.listFollowers('member', personId, PAGE, cursor);
    return this.pageOf(edges, (e) => ({ type: e.followerType, id: e.followerId }), await this.follows.countFollowers('member', personId));
  }

  /** GET /me/following (or the company's, with X-Act-As-Company). */
  async following(actor: Actor, cursor?: string) {
    const edges = await this.follows.listFollowing(actor.type, actor.id, PAGE, cursor);
    return this.pageOf(edges, (e) => ({ type: e.targetType, id: e.targetId }), edges.length);
  }

  // ------------------------------------------------------------------
  // Company summaries from org events (idempotent, at-least-once).
  // ------------------------------------------------------------------
  async onOrgEvent(event: { type: string; tenantId: string; occurredAt: string; payload: Record<string, unknown> }): Promise<void> {
    const p = event.payload;
    const tenantId = (p.orgId as string) || event.tenantId;
    if (!tenantId || tenantId === 'global') return;
    const existing = await this.companies.get(tenantId);
    const updated = (p.updatedFields ?? {}) as Record<string, unknown>;
    const nested = (p.brandKit ?? {}) as Record<string, unknown>;
    const pick = (key: string) => (updated[key] as string | undefined) ?? (p[key] as string | undefined);
    const name = pick('name') ?? existing?.name;
    if (!name) return;
    await this.companies.upsert({
      tenantId,
      name,
      slug: pick('slug') ?? existing?.slug,
      industry: pick('industry') ?? existing?.industry,
      city: pick('city') ?? existing?.city,
      logo: (p.logo as string | undefined) ?? (nested.logo as string | undefined) ?? existing?.logo,
      verified: event.type === 'kyb.status_changed' ? p.status === 'verified' : existing?.verified ?? false,
      updatedAt: event.occurredAt,
    });
  }
}
