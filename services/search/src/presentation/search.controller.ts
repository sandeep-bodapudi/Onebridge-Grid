import { Controller, Get, HttpException, Inject, Param, Query, Req } from '@nestjs/common';
import { InMemoryRateLimiter, RequestAuthenticator } from '@onebridge/shared';
import { SearchService } from '../application/search.service.js';

export const REQUEST_AUTHENTICATOR = 'REQUEST_AUTHENTICATOR';

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}

const truthy = (v?: string) => v === 'true' || v === '1';

/** N03: search, suggestions, directory pages and the industry taxonomy. Read-only and public. */
@Controller()
export class SearchController {
  /** Anonymous search is rate-limited per IP; signed-in members are not. */
  private readonly limiter = new InMemoryRateLimiter();

  constructor(
    private readonly search: SearchService,
    @Inject(REQUEST_AUTHENTICATOR) private readonly authenticator: RequestAuthenticator,
    @Inject('ANON_SEARCH_PER_MINUTE') private readonly anonPerMinute: number
  ) {}

  private async signedIn(req: RequestLike): Promise<boolean> {
    const headers = { ...req.headers };
    delete headers['x-tenant-id'];
    if (!headers.authorization) return false;
    try {
      const caller = await this.authenticator.authenticate(headers);
      return Boolean(caller.personId && caller.personId !== 'system');
    } catch {
      return false;
    }
  }

  private async guard(req: RequestLike): Promise<boolean> {
    const signedIn = await this.signedIn(req);
    if (signedIn) return true;
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0].trim() || req.ip || req.socket?.remoteAddress || 'unknown';
    const result = this.limiter.consume(`search:${ip}`, { limit: this.anonPerMinute, windowMs: 60_000 });
    if (!result.allowed) {
      throw new HttpException(
        {
          type: 'https://tools.ietf.org/html/rfc7807',
          title: 'Too Many Requests',
          status: 429,
          detail: 'Too many searches. Wait a minute, or sign in.',
          code: 'rate_limited',
          retryAfterSeconds: Math.ceil((result.retryAfterMs ?? 60_000) / 1000),
        },
        429
      );
    }
    return false;
  }

  @Get('search')
  async find(
    @Req() req: RequestLike,
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('industry') industry?: string,
    @Query('city') city?: string,
    @Query('verified') verified?: string,
    @Query('size') size?: string,
    @Query('hasCatalogue') hasCatalogue?: string,
    @Query('cursor') cursor?: string
  ) {
    const signedIn = await this.guard(req);
    return this.search.search({ q: q?.slice(0, 100), type, industry, city, verified: truthy(verified), size, hasCatalogue: truthy(hasCatalogue), cursor }, signedIn);
  }

  @Get('search/suggest')
  async suggest(@Req() req: RequestLike, @Query('q') q?: string) {
    const signedIn = await this.guard(req);
    return this.search.suggest(String(q ?? '').slice(0, 50), signedIn);
  }

  @Get('directory/:city/:industry')
  async directory(@Param('city') city: string, @Param('industry') industry: string, @Query('subCategory') sub?: string, @Query('cursor') cursor?: string) {
    return this.search.directory(city, industry, sub, cursor);
  }

  @Get('taxonomy/industries')
  taxonomy() {
    return this.search.taxonomy();
  }
}
