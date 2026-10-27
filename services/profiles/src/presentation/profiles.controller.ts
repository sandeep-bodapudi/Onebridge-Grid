import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Query,
  Res,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthenticationError, RequestAuthenticator } from '@onebridge/shared';
import { ProfilesService } from '../application/profiles.service.js';
import type { ProfileUpdateInput, WorkHistoryInput } from '../domain/member-profile.js';

export const REQUEST_AUTHENTICATOR = 'REQUEST_AUTHENTICATOR';

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
}

interface ResponseLike {
  status(code: number): this;
  setHeader(name: string, value: string): this;
  json(body: unknown): this;
}

const notFound = () =>
  new NotFoundException({ type: 'https://tools.ietf.org/html/rfc7807', title: 'Not Found', status: 404, detail: 'This profile does not exist or is not public.' });

/**
 * N01 endpoints. Profiles are personal (no company), so callers are
 * authenticated by their access token alone; X-Tenant-Id is ignored.
 */
@Controller()
export class ProfilesController {
  constructor(
    private readonly profiles: ProfilesService,
    @Inject(REQUEST_AUTHENTICATOR) private readonly authenticator: RequestAuthenticator,
    @Inject('INTERNAL_SERVICE_KEY') private readonly serviceKey: string
  ) {}

  /** Service-to-service only (x-service-key); used by the social service for follower lists. */
  @Get('internal/members')
  async internalSummaries(@Req() req: RequestLike, @Query('ids') ids?: string) {
    const key = req.headers['x-service-key'];
    if (!key || key !== this.serviceKey) {
      throw new ForbiddenException({ type: 'https://tools.ietf.org/html/rfc7807', title: 'Forbidden', status: 403, detail: 'Service key required' });
    }
    return { items: await this.profiles.summaries(String(ids || '').split(',')) };
  }

  private async personId(req: RequestLike): Promise<string> {
    try {
      const headers = { ...req.headers };
      delete headers['x-tenant-id'];
      const caller = await this.authenticator.authenticate(headers);
      if (!caller.personId || caller.personId === 'system') throw new AuthenticationError('Sign in required');
      return caller.personId;
    } catch (err) {
      if (err instanceof AuthenticationError) {
        throw new UnauthorizedException({
          type: 'https://tools.ietf.org/html/rfc7807',
          title: 'Unauthorized',
          status: 401,
          detail: 'Your session has expired or is missing. Sign in again.',
        });
      }
      throw err;
    }
  }

  /** Signed-in viewer if a valid token was sent, otherwise anonymous. */
  private async optionalPersonId(req: RequestLike): Promise<string | undefined> {
    return this.personId(req).catch(() => undefined);
  }

  @Get('me/profile')
  async getMine(@Req() req: RequestLike) {
    return this.profiles.getMine(await this.personId(req));
  }

  @Put('me/profile')
  async saveMine(@Req() req: RequestLike, @Body() body: ProfileUpdateInput) {
    return this.profiles.saveMine(await this.personId(req), body ?? {});
  }

  @Post('me/work-history')
  @HttpCode(HttpStatus.CREATED)
  async addWork(@Req() req: RequestLike, @Body() body: WorkHistoryInput) {
    return this.profiles.addWork(await this.personId(req), body ?? {});
  }

  @Patch('me/work-history/:entryId')
  async patchWork(@Req() req: RequestLike, @Param('entryId') entryId: string, @Body() body: WorkHistoryInput) {
    return this.profiles.patchWork(await this.personId(req), entryId, body ?? {});
  }

  @Delete('me/work-history/:entryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWork(@Req() req: RequestLike, @Param('entryId') entryId: string) {
    await this.profiles.deleteWork(await this.personId(req), entryId);
  }

  @Get('members/:handle')
  async getPublic(@Req() req: RequestLike, @Param('handle') handle: string, @Res() res: ResponseLike) {
    const result = await this.profiles.getPublic(handle, await this.optionalPersonId(req));
    if (result.kind === 'none') throw notFound();
    if (result.kind === 'redirect') {
      res.setHeader('Location', `/members/${result.handle}`);
      res.status(301).json({ handle: result.handle });
      return;
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).json(result.profile);
  }
}
