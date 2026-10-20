import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Headers,
  Req,
  Res,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@onebridge/shared';
import { ShortLinkService, ShortLinkError } from '../application/short-link.service.js';
import { InMemoryCacheStore } from './cards.controller.js';
import { TenantAuthGuard } from './guards/tenant-auth.guard.js';

export interface ResponseLike {
  status(code: number): this;
  setHeader(name: string, value: string): this;
  send(body: unknown): this;
  json(body: unknown): this;
  redirect(statusOrUrl: number | string, url?: string): void;
}

interface RequestLike {
  user?: { personId?: string; role?: Role; tenantId?: string };
  headers?: Record<string, string | string[] | undefined>;
}

const NEUTRAL_INACTIVE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Card Inactive | OneBridge Grid</title>
  <style>
    body { font-family: sans-serif; background: #FAF7F2; color: #1B2A4A; text-align: center; padding: 48px; }
    .card { background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 16px; padding: 32px; max-width: 420px; margin: 0 auto; }
    h1 { font-size: 18px; margin-bottom: 8px; }
    p { font-size: 14px; color: #6B7280; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Card or Link Inactive</h1>
    <p>This OneBridge Grid card or link is currently inactive, disabled, or not yet activated.</p>
  </div>
</body>
</html>`;

function toHttpException(err: unknown): never {
  if (err instanceof ShortLinkError) {
    const body = {
      type: 'https://tools.ietf.org/html/rfc7807',
      title: err.title,
      status: err.statusCode,
      detail: err.message,
    };
    if (err.statusCode === 404) throw new NotFoundException(body);
    if (err.statusCode === 403) throw new ForbiddenException(body);
    if (err.statusCode === 422) throw new UnprocessableEntityException(body);
    throw new BadRequestException(body);
  }
  // Unexpected: rethrow to GlobalExceptionFilter (500, no internal message).
  throw err;
}

@Controller()
export class ShortLinkController {
  private idempotencyStore = new InMemoryCacheStore();

  constructor(private readonly shortLinkService: ShortLinkService) {}

  @Get('r/:code')
  async resolveRedirect(@Param('code') code: string, @Res() res: ResponseLike): Promise<void> {
    const link = await this.shortLinkService.resolveShortLinkByCode(code);
    if (!link) {
      res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(NEUTRAL_INACTIVE_HTML);
      return;
    }

    if (link.status !== 'active') {
      res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(NEUTRAL_INACTIVE_HTML);
      return;
    }

    res.redirect(302, link.destinationUrl);
  }

  @Get('links/:code')
  async resolveMetadata(@Param('code') code: string) {
    const link = await this.shortLinkService.resolveShortLinkByCode(code);
    if (!link) {
      throw new NotFoundException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Not Found',
        status: 404,
        detail: `Shortlink "${code}" not found`,
      });
    }

    return {
      code: link.code,
      destinationUrl: link.destinationUrl,
      status: link.status,
      targetType: link.targetType,
      targetId: link.targetId,
      tenantId: link.tenantId,
      source: link.source,
    };
  }

  @Get('cards/:cardId/qr')
  @UseGuards(TenantAuthGuard)
  async listCardQrs(
    @Param('cardId') cardId: string,
    @Headers('x-tenant-id') tenantHeader?: string,
    @Req() req?: RequestLike
  ) {
    const tenantId = req?.user?.tenantId ?? tenantHeader;
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    try {
      return await this.shortLinkService.listCardQrs(tenantId, cardId);
    } catch (err) {
      toHttpException(err);
    }
  }

  @Post('cards/:cardId/qr')
  @UseGuards(TenantAuthGuard)
  async createCardQr(
    @Param('cardId') cardId: string,
    @Body() body: { source: string; label?: string; destinationUrl?: string },
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Req() req?: RequestLike
  ) {
    const tenantId = req?.user?.tenantId ?? tenantHeader;
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const callerRole = req?.user?.role;
    const callerPersonId = req?.user?.personId;

    return this.handleIdempotency(tenantId, idempotencyKey, body, async () => {
      try {
        return await this.shortLinkService.createCardQr(
          tenantId,
          cardId,
          body?.source,
          body?.label,
          body?.destinationUrl,
          callerRole,
          callerPersonId
        );
      } catch (err) {
        toHttpException(err);
      }
    });
  }

  @Patch('cards/:cardId/qr/:qrId')
  @UseGuards(TenantAuthGuard)
  async updateCardQr(
    @Param('cardId') cardId: string,
    @Param('qrId') qrId: string,
    @Body() body: { destinationUrl?: string; label?: string; status?: 'active' | 'disabled' },
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Req() req?: RequestLike
  ) {
    const tenantId = req?.user?.tenantId ?? tenantHeader;
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const callerRole = req?.user?.role;
    const callerPersonId = req?.user?.personId;

    return this.handleIdempotency(tenantId, idempotencyKey, body, async () => {
      try {
        return await this.shortLinkService.repointShortLink(tenantId, cardId, qrId, {
          destinationUrl: body?.destinationUrl,
          label: body?.label,
          status: body?.status,
          callerRole,
          callerPersonId,
        });
      } catch (err) {
        toHttpException(err);
      }
    });
  }

  @Get('cards/:cardId/qr/:file')
  async downloadCardQr(
    @Param('cardId') cardId: string,
    @Param('file') file: string,
    @Query('tenantId') tenantQuery?: string,
    @Query('size') sizeStr?: string,
    @Headers('x-tenant-id') tenantHeader?: string,
    @Req() req?: RequestLike,
    @Res() res?: ResponseLike
  ): Promise<void> {
    const tenantId = req?.user?.tenantId ?? tenantHeader ?? tenantQuery;
    if (!tenantId) {
      res?.status(400).json({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Bad Request',
        status: 400,
        detail: 'x-tenant-id header or tenantId query parameter is required',
      });
      return;
    }

    const dotIndex = file.lastIndexOf('.');
    if (dotIndex === -1) {
      res?.status(404).send('Not Found');
      return;
    }

    const qrId = file.slice(0, dotIndex);
    const format = file.slice(dotIndex + 1).toLowerCase() as 'png' | 'svg' | 'pdf';
    const size = sizeStr ? parseInt(sizeStr, 10) : 1000;

    try {
      const asset = await this.shortLinkService.generateQrAsset(tenantId, cardId, qrId, format, size);
      res?.setHeader('Content-Type', asset.contentType);
      res?.send(asset.content);
    } catch (err) {
      if (err instanceof ShortLinkError) {
        res?.status(err.statusCode).json({
          type: 'https://tools.ietf.org/html/rfc7807',
          title: err.title,
          status: err.statusCode,
          detail: err.message,
        });
        return;
      }
      res?.status(500).send('Internal Server Error');
    }
  }

  @Get('orgs/:tenantId/qr/standee')
  @UseGuards(TenantAuthGuard)
  async downloadCompanyStandee(
    @Param('tenantId') tenantId: string,
    @Query('template') templateStr?: string,
    @Query('format') formatStr?: string,
    @Headers('x-tenant-id') tenantHeader?: string,
    @Req() req?: RequestLike,
    @Res() res?: ResponseLike
  ): Promise<void> {
    const callerTenantId = req?.user?.tenantId ?? tenantHeader;
    if (!callerTenantId || callerTenantId !== tenantId) {
      throw new ForbiddenException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: 'Cross-tenant standee generation is not permitted',
      });
    }

    const template = (templateStr === 'a5' ? 'a5' : 'a4') as 'a4' | 'a5';
    const format = (formatStr === 'svg' ? 'svg' : 'pdf') as 'pdf' | 'svg';

    try {
      const asset = await this.shortLinkService.generateStandeeAsset(tenantId, undefined, template, format);
      res?.setHeader('Content-Type', asset.contentType);
      res?.send(asset.content);
    } catch (err) {
      toHttpException(err);
    }
  }

  @Get('orgs/:tenantId/branches/:branchId/qr/standee')
  @UseGuards(TenantAuthGuard)
  async downloadBranchStandee(
    @Param('tenantId') tenantId: string,
    @Param('branchId') branchId: string,
    @Query('template') templateStr?: string,
    @Query('format') formatStr?: string,
    @Headers('x-tenant-id') tenantHeader?: string,
    @Req() req?: RequestLike,
    @Res() res?: ResponseLike
  ): Promise<void> {
    const callerTenantId = req?.user?.tenantId ?? tenantHeader;
    if (!callerTenantId || callerTenantId !== tenantId) {
      throw new ForbiddenException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: 'Cross-tenant standee generation is not permitted',
      });
    }

    const template = (templateStr === 'a5' ? 'a5' : 'a4') as 'a4' | 'a5';
    const format = (formatStr === 'svg' ? 'svg' : 'pdf') as 'pdf' | 'svg';

    try {
      const asset = await this.shortLinkService.generateStandeeAsset(tenantId, branchId, template, format);
      res?.setHeader('Content-Type', asset.contentType);
      res?.send(asset.content);
    } catch (err) {
      toHttpException(err);
    }
  }

  private async handleIdempotency<T>(
    tenantId: string,
    key: string | undefined,
    requestBody: unknown,
    execute: () => Promise<T>
  ): Promise<T> {
    if (!key) return execute();

    const cacheKey = `idem:${tenantId}:${key}`;
    const cached = await this.idempotencyStore.get(cacheKey);

    if (cached) {
      const cachedBodyStr = JSON.stringify(cached.requestBody ?? {});
      const incomingBodyStr = JSON.stringify(requestBody ?? {});

      if (cachedBodyStr !== incomingBodyStr) {
        throw new UnprocessableEntityException({
          type: 'https://tools.ietf.org/html/rfc7807',
          title: 'Unprocessable Entity',
          status: 422,
          detail: `Idempotency key "${key}" was previously used with a different request payload.`,
        });
      }

      return cached.response as T;
    }

    const result = await execute();
    await this.idempotencyStore.set(cacheKey, { requestBody, response: result }, 86400);
    return result;
  }
}
