import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  Headers,
  Req,
  Res,
  HttpCode,
  HttpException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@onebridge/shared';
import { ProblemError } from '../application/cards.service.js';
import { CompanyProfileService } from '../application/company-profile.service.js';
import {
  CardNotFoundError,
  InvalidSharebackError,
  RateLimitExceededError,
  TurnstileVerificationFailedError,
} from '../application/shareback.service.js';
import { CatalogueLimitError, InvalidCompanyProfileError } from '../domain/company-profile.js';
import { ConsentRequiredError } from '../domain/lead.js';
import { TenantAuthGuard } from './guards/tenant-auth.guard.js';
import { ResponseLike } from './public-cards.controller.js';

interface RequestLike {
  user?: { personId?: string; role?: Role; tenantId?: string };
  headers?: Record<string, string>;
  ip?: string;
  socket?: { remoteAddress?: string };
}

function problem(status: number, title: string, detail: string) {
  return { type: 'https://tools.ietf.org/html/rfc7807', title, status, detail };
}

function toHttpException(err: unknown): never {
  if (err instanceof HttpException) throw err;
  if (err instanceof RateLimitExceededError) {
    throw new HttpException({ ...problem(429, 'Too Many Requests', err.message), retryAfterSeconds: err.retryAfterSeconds }, 429);
  }
  if (err instanceof CatalogueLimitError) {
    throw new UnprocessableEntityException({ ...problem(422, 'Over the catalogue limit', err.message), limit: err.limit });
  }
  if (
    err instanceof InvalidCompanyProfileError ||
    err instanceof InvalidSharebackError ||
    err instanceof TurnstileVerificationFailedError ||
    err instanceof ConsentRequiredError
  ) {
    throw new BadRequestException(problem(400, 'Bad Request', err.message));
  }
  if (err instanceof CardNotFoundError) throw new NotFoundException(problem(404, 'Not Found', err.message));
  if (err instanceof ProblemError) {
    if (err.status === 404) throw new NotFoundException(problem(404, err.title, err.message));
    if (err.status === 403) throw new ForbiddenException(problem(403, err.title, err.message));
    throw new BadRequestException(problem(400, err.title, err.message));
  }
  throw err;
}

/** F26: company page settings for admins. */
@Controller('company-profile')
@UseGuards(TenantAuthGuard)
export class CompanyProfileController {
  constructor(private readonly service: CompanyProfileService) {}

  private tenantOf(req?: RequestLike, headerTenantId?: string): string {
    const tenantId = headerTenantId || req?.user?.tenantId;
    if (!tenantId) throw new ForbiddenException(problem(403, 'Forbidden', 'Missing tenant context'));
    return tenantId;
  }

  @Get()
  async get(@Headers('x-tenant-id') headerTenantId?: string, @Req() req?: RequestLike) {
    return this.service.getSettings(this.tenantOf(req, headerTenantId));
  }

  @Put()
  async put(@Body() body: Record<string, unknown>, @Headers('x-tenant-id') headerTenantId?: string, @Req() req?: RequestLike) {
    try {
      return await this.service.updateSettings(this.tenantOf(req, headerTenantId), (req?.user?.role || 'viewer') as Role, body ?? {});
    } catch (err) {
      toHttpException(err);
    }
  }
}

function clientIpOf(req?: RequestLike): string {
  return (
    req?.headers?.['cf-connecting-ip'] ||
    (req?.headers?.['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : undefined) ||
    req?.ip ||
    req?.socket?.remoteAddress ||
    '127.0.0.1'
  );
}

/** F26: the public company page, enquiries and document downloads. */
@Controller('public/o')
export class PublicCompaniesController {
  constructor(private readonly service: CompanyProfileService) {}

  @Get(':slug')
  async profile(@Param('slug') slug: string, @Query('branch') branch?: string) {
    try {
      return await this.service.getPublicProfile(slug, typeof branch === 'string' ? branch : undefined);
    } catch (err) {
      toHttpException(err);
    }
  }

  @Post(':slug/view')
  @HttpCode(202)
  async view(@Param('slug') slug: string, @Body() body?: Record<string, unknown>) {
    try {
      await this.service.recordView(slug, typeof body?.branchId === 'string' ? body.branchId : undefined);
      return { accepted: true };
    } catch (err) {
      toHttpException(err);
    }
  }

  @Post(':slug/enquiry')
  async enquiry(
    @Param('slug') slug: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestLike,
    @Res() res: ResponseLike
  ): Promise<void> {
    const opt = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
    try {
      const result = await this.service.submitEnquiry(slug, {
        name: String(body?.name || ''),
        phone: String(body?.phone || ''),
        email: opt(body?.email),
        company: opt(body?.company),
        message: opt(body?.message),
        productId: opt(body?.productId),
        branchId: opt(body?.branchId),
        consent: body?.consent === true,
        turnstileToken: opt(body?.turnstileToken),
        clientIp: clientIpOf(req),
      });
      res.status(result.status === 'created' ? 201 : 200).json(result);
    } catch (err) {
      if (err instanceof RateLimitExceededError) res.setHeader('Retry-After', String(err.retryAfterSeconds));
      toHttpException(err);
    }
  }

  @Get(':slug/documents/:documentId')
  async document(@Param('slug') slug: string, @Param('documentId') documentId: string, @Res() res: ResponseLike): Promise<void> {
    try {
      const url = await this.service.documentUrl(slug, documentId);
      res.setHeader('Location', url);
      res.setHeader('Cache-Control', 'no-store');
      res.status(302).send('');
    } catch (err) {
      toHttpException(err);
    }
  }
}
