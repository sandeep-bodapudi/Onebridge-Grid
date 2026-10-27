import { Controller, Delete, ForbiddenException, Get, Inject, Param, Put, Query, Req, UnauthorizedException } from '@nestjs/common';
import { AuthenticationError, RequestAuthenticator } from '@onebridge/shared';
import { Actor, FollowService } from '../application/follow.service.js';

export const REQUEST_AUTHENTICATOR = 'REQUEST_AUTHENTICATOR';

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
}

const header = (req: RequestLike, name: string) => {
  const v = req.headers[name];
  return (Array.isArray(v) ? v[0] : v) || undefined;
};

/** N04 follow endpoints. */
@Controller()
export class FollowController {
  constructor(
    private readonly follows: FollowService,
    @Inject(REQUEST_AUTHENTICATOR) private readonly authenticator: RequestAuthenticator
  ) {}

  private async authenticate(req: RequestLike, tenantId?: string) {
    const headers = { ...req.headers };
    delete headers['x-tenant-id'];
    if (tenantId) headers['x-tenant-id'] = tenantId;
    try {
      const caller = await this.authenticator.authenticate(headers);
      if (!caller.personId || caller.personId === 'system') throw new AuthenticationError('Sign in required');
      return caller;
    } catch (err) {
      if (err instanceof AuthenticationError) {
        throw new UnauthorizedException({ type: 'https://tools.ietf.org/html/rfc7807', title: 'Unauthorized', status: 401, detail: 'Sign in to continue.' });
      }
      throw err;
    }
  }

  /** The member, or the company named in X-Act-As-Company when the caller is its owner or an admin. */
  private async actor(req: RequestLike): Promise<Actor> {
    const company = header(req, 'x-act-as-company');
    const caller = await this.authenticate(req, company);
    if (!company) return { type: 'member', id: caller.personId };
    if (caller.role !== 'owner' && caller.role !== 'admin') {
      throw new ForbiddenException({ type: 'https://tools.ietf.org/html/rfc7807', title: 'Forbidden', status: 403, detail: 'Only the company owner or an admin can act for the company.' });
    }
    return { type: 'company', id: company };
  }

  private async optionalActor(req: RequestLike): Promise<Actor | null> {
    return this.actor(req).catch((err) => {
      if (err instanceof UnauthorizedException) return null;
      throw err;
    });
  }

  @Get('follows/:targetType/:targetId')
  async state(@Req() req: RequestLike, @Param('targetType') targetType: string, @Param('targetId') targetId: string) {
    return this.follows.state(await this.optionalActor(req), targetType, targetId);
  }

  @Put('follows/:targetType/:targetId')
  async follow(@Req() req: RequestLike, @Param('targetType') targetType: string, @Param('targetId') targetId: string, @Query('source') source?: string) {
    return this.follows.follow(await this.actor(req), targetType, targetId, source);
  }

  @Delete('follows/:targetType/:targetId')
  async unfollow(@Req() req: RequestLike, @Param('targetType') targetType: string, @Param('targetId') targetId: string) {
    return this.follows.unfollow(await this.actor(req), targetType, targetId);
  }

  @Get('companies/:companyId/followers')
  async companyFollowers(@Req() req: RequestLike, @Param('companyId') companyId: string, @Query('cursor') cursor?: string) {
    const caller = await this.authenticate(req, companyId);
    return this.follows.companyFollowers(companyId, caller.role, cursor);
  }

  @Get('members/:personId/followers')
  async memberFollowers(@Req() req: RequestLike, @Param('personId') personId: string, @Query('cursor') cursor?: string) {
    await this.authenticate(req);
    return this.follows.memberFollowers(personId, cursor);
  }

  @Get('me/following')
  async following(@Req() req: RequestLike, @Query('cursor') cursor?: string) {
    return this.follows.following(await this.actor(req), cursor);
  }
}
