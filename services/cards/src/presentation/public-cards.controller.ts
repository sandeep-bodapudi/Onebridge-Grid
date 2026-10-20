import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  Res,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnprocessableEntityException,
  HttpException,
  Optional,
} from '@nestjs/common';
import { CacheStore } from '@onebridge/shared';
import { CardsService, ProblemError } from '../application/cards.service.js';
import { InMemoryCacheStore } from './cards.controller.js';
import {
  SharebackService,
  CardNotFoundError,
  RateLimitExceededError,
  TurnstileVerificationFailedError,
  InvalidSharebackError,
} from '../application/shareback.service.js';
import { ConsentRequiredError } from '../domain/lead.js';

export interface ResponseLike {
  status(code: number): this;
  setHeader(name: string, value: string): this;
  send(body: unknown): this;
  json(body: unknown): this;
}

function toHttpException(err: unknown): never {
  if (err instanceof HttpException) {
    throw err;
  }
  if (err instanceof RateLimitExceededError) {
    const body = {
      type: 'https://tools.ietf.org/html/rfc7807',
      title: 'Too Many Requests',
      status: 429,
      detail: err.message,
      retryAfterSeconds: err.retryAfterSeconds,
    };
    throw new HttpException(body, 429);
  }
  if (err instanceof CardNotFoundError) {
    const body = {
      type: 'https://tools.ietf.org/html/rfc7807',
      title: 'Not Found',
      status: 404,
      detail: err.message,
    };
    throw new NotFoundException(body);
  }
  if (
    err instanceof TurnstileVerificationFailedError ||
    err instanceof InvalidSharebackError ||
    err instanceof ConsentRequiredError
  ) {
    const body = {
      type: 'https://tools.ietf.org/html/rfc7807',
      title: 'Bad Request',
      status: 400,
      detail: err.message,
    };
    throw new BadRequestException(body);
  }
  if (err instanceof ProblemError) {
    const body = {
      type: 'https://tools.ietf.org/html/rfc7807',
      title: err.title,
      status: err.status,
      detail: err.message,
    };
    if (err.status === 404) throw new NotFoundException(body);
    if (err.status === 403) throw new ForbiddenException(body);
    throw new BadRequestException(body);
  }
  if (err instanceof Error) {
    const body = {
      type: 'https://tools.ietf.org/html/rfc7807',
      title: 'Bad Request',
      status: 400,
      detail: err.message,
    };
    throw new BadRequestException(body);
  }
  throw err;
}

@Controller('public/c')
export class PublicCardsController {
  private cacheStore: CacheStore = new InMemoryCacheStore();

  constructor(
    private readonly cardsService: CardsService,
    @Optional() private readonly sharebackService?: SharebackService
  ) {}

  setCacheStore(cacheStore: CacheStore): void {
    this.cacheStore = cacheStore;
  }

  @Get(':orgSlug/:cardSlug/vcard')
  async getVCardMulti(
    @Param('orgSlug') orgSlug: string,
    @Param('cardSlug') cardSlug: string,
    @Res() res: ResponseLike
  ): Promise<void> {
    await this.handleVCard(`${orgSlug}/${cardSlug}`, res);
  }

  @Get(':slug/vcard')
  async getVCardSingle(
    @Param('slug') slug: string,
    @Res() res: ResponseLike
  ): Promise<void> {
    await this.handleVCard(slug, res);
  }

  @Get(':orgSlug/:cardSlug')
  async getCardMulti(
    @Param('orgSlug') orgSlug: string,
    @Param('cardSlug') cardSlug: string
  ) {
    return this.handleCard(`${orgSlug}/${cardSlug}`);
  }

  @Get(':slug')
  async getCardSingle(
    @Param('slug') slug: string
  ) {
    return this.handleCard(slug);
  }

  @Post(':orgSlug/:cardSlug/shareback')
  async submitSharebackMulti(
    @Param('orgSlug') orgSlug: string,
    @Param('cardSlug') cardSlug: string,
    @Query('source') source: string | undefined,
    @Query('sourceTag') sourceTag: string | undefined,
    @Body() body: Record<string, unknown>,
    @Req() req: { headers?: Record<string, string>; ip?: string; socket?: { remoteAddress?: string } },
    @Res() res: ResponseLike
  ): Promise<void> {
    await this.handleShareback(`${orgSlug}/${cardSlug}`, source, sourceTag, body, req, res);
  }

  @Post(':slug/shareback')
  async submitSharebackSingle(
    @Param('slug') slug: string,
    @Query('source') source: string | undefined,
    @Query('sourceTag') sourceTag: string | undefined,
    @Body() body: Record<string, unknown>,
    @Req() req: { headers?: Record<string, string>; ip?: string; socket?: { remoteAddress?: string } },
    @Res() res: ResponseLike
  ): Promise<void> {
    await this.handleShareback(slug, source, sourceTag, body, req, res);
  }

  private async handleCard(slug: string) {
    try {
      return await this.cardsService.getPublicCardView(slug);
    } catch (err: unknown) {
      toHttpException(err);
    }
  }

  private async handleVCard(slug: string, res: ResponseLike): Promise<void> {
    try {
      const { vcard, filename } = await this.cardsService.getPublicCardVCard(slug);
      res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      res.status(200).send(vcard);
    } catch (err: unknown) {
      toHttpException(err);
    }
  }

  private async handleShareback(
    slug: string,
    source: string | undefined,
    sourceTag: string | undefined,
    body: Record<string, unknown>,
    req: { headers?: Record<string, string>; ip?: string; socket?: { remoteAddress?: string } },
    res: ResponseLike
  ): Promise<void> {
    if (!this.sharebackService) {
      throw new BadRequestException('Shareback service is not available');
    }

    const clientIp =
      req?.headers?.['cf-connecting-ip'] ||
      (req?.headers?.['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : undefined) ||
      req?.ip ||
      req?.socket?.remoteAddress ||
      '127.0.0.1';

    const rawHeaders = req?.headers || {};
    const idempotencyKey =
      (rawHeaders['idempotency-key'] as string | undefined) ||
      (rawHeaders['Idempotency-Key'] as string | undefined) ||
      (rawHeaders[Object.keys(rawHeaders).find((k) => k.toLowerCase() === 'idempotency-key') || ''] as string | undefined);

    try {
      if (idempotencyKey) {
        const cached = await this.cacheStore.get(idempotencyKey);
        if (cached) {
          if (JSON.stringify(cached.requestBody) !== JSON.stringify(body)) {
            throw new UnprocessableEntityException({
              type: 'https://tools.ietf.org/html/rfc7807',
              title: 'Unprocessable Entity',
              status: 422,
              detail: 'Mismatching request body for provided Idempotency-Key',
            });
          }
          const cachedRes = cached.response as { statusCode: number; data: unknown };
          res.status(cachedRes.statusCode).json(cachedRes.data);
          return;
        }
      }

      const result = await this.sharebackService.submitShareback({
        slug,
        name: String(body?.name || ''),
        phone: String(body?.phone || ''),
        email: body?.email ? String(body.email) : undefined,
        company: body?.company ? String(body.company) : undefined,
        note: body?.note ? String(body.note) : undefined,
        consent: Boolean(body?.consent),
        noticeVersion: body?.noticeVersion ? String(body.noticeVersion) : undefined,
        source:
          (source as 'qr' | 'nfc' | 'link' | 'shareback' | undefined) ||
          (body?.source as 'qr' | 'nfc' | 'link' | 'shareback' | undefined) ||
          'shareback',
        sourceTag: sourceTag || (body?.sourceTag ? String(body.sourceTag) : undefined),
        turnstileToken: body?.turnstileToken ? String(body.turnstileToken) : undefined,
        clientIp,
      });

      const statusCode = result.status === 'created' ? 201 : 200;
      if (idempotencyKey) {
        await this.cacheStore.set(
          idempotencyKey,
          { requestBody: body, response: { statusCode, data: result } },
          86400
        );
      }
      res.status(statusCode).json(result);
    } catch (err: unknown) {
      if (err instanceof RateLimitExceededError) {
        res.setHeader('Retry-After', String(err.retryAfterSeconds));
      }
      toHttpException(err);
    }
  }
}
