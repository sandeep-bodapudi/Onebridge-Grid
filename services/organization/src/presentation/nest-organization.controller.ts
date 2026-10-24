import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Param,
  Body,
  Headers,
  Req,
  Res,
  HttpStatus,
  HttpCode,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import {
  TenantContext,
  Role,
  CacheStore,
  CachedIdempotencyRecord,
} from '@onebridge/shared';
import {
  OrganizationService,
  UpdateOrganizationDto,
} from '../application/organization.service.js';
import { BrandKitService } from '../application/brand-kit.service.js';
import {
  UpdateBrandKitDto,
  UpdateFieldLocksDto,
  UploadLogoDto,
} from '../domain/brand-kit.js';
import { TenantAuthGuard } from './guards/tenant-auth.guard.js';

export interface HttpResponse {
  status(code: number): this;
  setHeader(name: string, value: string): this;
}

export interface RequestLike {
  user?: {
    personId?: string;
    role?: Role;
    tenantId?: string;
    /** 'token' when the guard verified an access token (D-SERVICE-AUTH). */
    via?: 'token' | 'test-headers';
  };
  headers?: Record<string, string | string[] | undefined>;
}

export class InMemoryCacheStore implements CacheStore {
  private cache = new Map<string, { value: CachedIdempotencyRecord; expiresAt: number }>();

  async get(key: string): Promise<CachedIdempotencyRecord | null> {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: CachedIdempotencyRecord, ttlSeconds: number): Promise<void> {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  clear(): void {
    this.cache.clear();
  }
}

@Controller('orgs')
@UseGuards(TenantAuthGuard)
export class NestOrganizationController {
  private cacheStore: CacheStore;

  constructor(
    private readonly orgService: OrganizationService,
    private readonly brandKitService: BrandKitService
  ) {
    this.cacheStore = new InMemoryCacheStore();
  }

  setCacheStore(cacheStore: CacheStore): void {
    this.cacheStore = cacheStore;
  }

  private async handleIdempotency<T>(
    idempotencyKey: string | undefined,
    requestBody: unknown,
    correlationId: string,
    action: () => Promise<T>
  ): Promise<T> {
    if (!idempotencyKey) {
      return action();
    }

    const cached = await this.cacheStore.get(idempotencyKey);
    if (cached) {
      if (JSON.stringify(cached.requestBody) !== JSON.stringify(requestBody)) {
        throw new UnprocessableEntityException({
          type: 'https://tools.ietf.org/html/rfc7807',
          title: 'Unprocessable Entity',
          status: 422,
          detail: 'Mismatching request body for provided Idempotency-Key',
          correlationId,
        });
      }
      return cached.response as T;
    }

    const result = await action();
    await this.cacheStore.set(idempotencyKey, { requestBody, response: result }, 86400);
    return result;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrganization(
    @Body()
    body: {
      name: string;
      legalName?: string;
      industry: string;
      size: string;
      city: string;
      gstin?: string;
      slug?: string;
      plan?: 'starter' | 'business';
      website?: string;
      creatorPersonId?: string;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Req() req?: RequestLike,
    @Res({ passthrough: true }) res?: HttpResponse
  ) {
    const effectiveCorrelationId = correlationId || (req?.headers?.['x-correlation-id'] as string) || 'unknown';

    // With a verified token the creator is always the signed-in person; a
    // body-supplied creatorPersonId is honoured only in header-trusting tests.
    const creatorPersonId =
      req?.user?.via === 'token'
        ? req.user.personId
        : body.creatorPersonId ||
          (req?.headers?.['x-user-id'] as string) ||
          (req?.user?.personId && req.user.personId !== 'system' ? req.user.personId : undefined);

    if (!creatorPersonId || !creatorPersonId.trim()) {
      throw new BadRequestException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Bad Request',
        status: 400,
        detail: 'creatorPersonId or X-User-Id is required to establish Owner membership',
        correlationId: effectiveCorrelationId,
      });
    }

    return this.handleIdempotency(
      idempotencyKey,
      body,
      effectiveCorrelationId,
      async () => {
        const org = await this.orgService.createOrganization({
          ...body,
          creatorPersonId,
          idempotencyKey,
          correlationId: effectiveCorrelationId,
        });

        if (res) {
          res.setHeader('Location', `/orgs/${org.id}`);
        }

        return org;
      }
    );
  }

  @Get('by-slug/:slug')
  async getBySlug(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: HttpResponse
  ) {
    const resolution = await this.orgService.resolveSlug(slug);

    if (resolution.status === 404) {
      throw new NotFoundException(`Organization with slug "${slug}" not found`);
    }

    if (resolution.status === 301) {
      const targetLocation = `/orgs/by-slug/${resolution.redirectToSlug}`;
      res.status(HttpStatus.MOVED_PERMANENTLY);
      res.setHeader('Location', targetLocation);
      return {
        statusCode: 301,
        message: 'Permanent redirect',
        location: targetLocation,
      };
    }

    return resolution.organization;
  }

  @Get(':id')
  async getOrganization(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantIdHeader?: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Req() req?: RequestLike
  ) {
    const effectiveCorrelationId = correlationId || (req?.headers?.['x-correlation-id'] as string) || 'unknown';
    const effectiveTenantId = tenantIdHeader || req?.user?.tenantId;

    if (!effectiveTenantId || effectiveTenantId !== id) {
      throw new ForbiddenException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: `Access denied: Caller tenant "${effectiveTenantId || 'none'}" cannot access organization "${id}"`,
        correlationId: effectiveCorrelationId,
      });
    }

    return TenantContext.run(effectiveTenantId, () => this.orgService.getOrganization(id));
  }

  @Patch(':id')
  async updateOrganization(
    @Param('id') id: string,
    @Body() body: UpdateOrganizationDto,
    @Headers('x-tenant-id') tenantIdHeader?: string,
    @Headers('x-user-role') roleHeader?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Req() req?: RequestLike
  ) {
    const effectiveCorrelationId = correlationId || (req?.headers?.['x-correlation-id'] as string) || 'unknown';
    const effectiveTenantId = tenantIdHeader || req?.user?.tenantId;

    if (!effectiveTenantId || effectiveTenantId !== id) {
      throw new ForbiddenException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: `Access denied: Caller tenant "${effectiveTenantId || 'none'}" cannot edit organization "${id}"`,
        correlationId: effectiveCorrelationId,
      });
    }

    const role = (roleHeader as Role) || req?.user?.role;
    if (!role || (role !== 'owner' && role !== 'admin')) {
      throw new ForbiddenException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: `Access denied: Role "${role || 'none'}" has insufficient permissions to edit company profile. Required: owner or admin`,
        correlationId: effectiveCorrelationId,
      });
    }

    return this.handleIdempotency(
      idempotencyKey,
      { id, ...body },
      effectiveCorrelationId,
      () =>
        TenantContext.run(effectiveTenantId, () =>
          this.orgService.updateOrganization(id, body, {
            personId: req?.user?.personId,
            role,
            correlationId: effectiveCorrelationId,
          })
        )
    );
  }

  @Post(':id/first-card')
  @HttpCode(HttpStatus.OK)
  async recordFirstCard(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantIdHeader?: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Req() req?: RequestLike
  ) {
    const effectiveCorrelationId = correlationId || (req?.headers?.['x-correlation-id'] as string) || 'unknown';
    const effectiveTenantId = tenantIdHeader || req?.user?.tenantId;

    if (!effectiveTenantId || effectiveTenantId !== id) {
      throw new ForbiddenException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: `Access denied: Caller tenant "${effectiveTenantId || 'none'}" cannot access organization "${id}"`,
        correlationId: effectiveCorrelationId,
      });
    }

    return TenantContext.run(effectiveTenantId, () =>
      this.orgService.recordFirstCardPublished(id)
    );
  }

  @Get(':id/brand')
  async getBrandKit(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantIdHeader?: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Req() req?: RequestLike
  ) {
    const effectiveCorrelationId = correlationId || (req?.headers?.['x-correlation-id'] as string) || 'unknown';
    const effectiveTenantId = tenantIdHeader || req?.user?.tenantId;

    if (!effectiveTenantId || effectiveTenantId !== id) {
      throw new ForbiddenException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: `Access denied: Caller tenant "${effectiveTenantId || 'none'}" cannot access organization "${id}"`,
        correlationId: effectiveCorrelationId,
      });
    }

    return TenantContext.run(effectiveTenantId, () => this.brandKitService.getBrandKit(id));
  }

  @Patch(':id/brand')
  async updateBrandKit(
    @Param('id') id: string,
    @Body() body: UpdateBrandKitDto,
    @Headers('x-tenant-id') tenantIdHeader?: string,
    @Headers('x-user-role') roleHeader?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Req() req?: RequestLike
  ) {
    const effectiveCorrelationId = correlationId || (req?.headers?.['x-correlation-id'] as string) || 'unknown';
    const effectiveTenantId = tenantIdHeader || req?.user?.tenantId;

    if (!effectiveTenantId || effectiveTenantId !== id) {
      throw new ForbiddenException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: `Access denied: Caller tenant "${effectiveTenantId || 'none'}" cannot edit brand kit for organization "${id}"`,
        correlationId: effectiveCorrelationId,
      });
    }

    const role = (roleHeader as Role) || req?.user?.role;
    if (!role || (role !== 'owner' && role !== 'admin')) {
      throw new ForbiddenException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: `Access denied: Role "${role || 'none'}" has insufficient permissions to edit brand kit. Required: owner or admin`,
        correlationId: effectiveCorrelationId,
      });
    }

    return this.handleIdempotency(
      idempotencyKey,
      { id, ...body },
      effectiveCorrelationId,
      () =>
        TenantContext.run(effectiveTenantId, () =>
          this.brandKitService.updateBrandKit(id, body, {
            personId: req?.user?.personId,
            role,
            correlationId: effectiveCorrelationId,
          })
        )
    );
  }

  @Get(':id/locks')
  async getFieldLocks(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantIdHeader?: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Req() req?: RequestLike
  ) {
    const effectiveCorrelationId = correlationId || (req?.headers?.['x-correlation-id'] as string) || 'unknown';
    const effectiveTenantId = tenantIdHeader || req?.user?.tenantId;

    if (!effectiveTenantId || effectiveTenantId !== id) {
      throw new ForbiddenException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: `Access denied: Caller tenant "${effectiveTenantId || 'none'}" cannot access organization "${id}"`,
        correlationId: effectiveCorrelationId,
      });
    }

    return TenantContext.run(effectiveTenantId, () => this.brandKitService.getFieldLocks(id));
  }

  @Put(':id/locks')
  async updateFieldLocks(
    @Param('id') id: string,
    @Body() body: UpdateFieldLocksDto,
    @Headers('x-tenant-id') tenantIdHeader?: string,
    @Headers('x-user-role') roleHeader?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Req() req?: RequestLike
  ) {
    const effectiveCorrelationId = correlationId || (req?.headers?.['x-correlation-id'] as string) || 'unknown';
    const effectiveTenantId = tenantIdHeader || req?.user?.tenantId;

    if (!effectiveTenantId || effectiveTenantId !== id) {
      throw new ForbiddenException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: `Access denied: Caller tenant "${effectiveTenantId || 'none'}" cannot edit field locks for organization "${id}"`,
        correlationId: effectiveCorrelationId,
      });
    }

    const role = (roleHeader as Role) || req?.user?.role;
    if (!role || (role !== 'owner' && role !== 'admin')) {
      throw new ForbiddenException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: `Access denied: Role "${role || 'none'}" has insufficient permissions to edit field locks. Required: owner or admin`,
        correlationId: effectiveCorrelationId,
      });
    }

    return this.handleIdempotency(
      idempotencyKey,
      { id, ...body },
      effectiveCorrelationId,
      () =>
        TenantContext.run(effectiveTenantId, () =>
          this.brandKitService.updateFieldLocks(id, body, {
            personId: req?.user?.personId,
            role,
            correlationId: effectiveCorrelationId,
          })
        )
    );
  }

  @Post(':id/brand/logo')
  @HttpCode(HttpStatus.OK)
  async uploadLogo(
    @Param('id') id: string,
    @Body() body: UploadLogoDto,
    @Headers('x-tenant-id') tenantIdHeader?: string,
    @Headers('x-user-role') roleHeader?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Req() req?: RequestLike
  ) {
    const effectiveCorrelationId = correlationId || (req?.headers?.['x-correlation-id'] as string) || 'unknown';
    const effectiveTenantId = tenantIdHeader || req?.user?.tenantId;

    if (!effectiveTenantId || effectiveTenantId !== id) {
      throw new ForbiddenException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: `Access denied: Caller tenant "${effectiveTenantId || 'none'}" cannot upload logo for organization "${id}"`,
        correlationId: effectiveCorrelationId,
      });
    }

    const role = (roleHeader as Role) || req?.user?.role;
    if (!role || (role !== 'owner' && role !== 'admin')) {
      throw new ForbiddenException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: `Access denied: Role "${role || 'none'}" has insufficient permissions to upload brand logo. Required: owner or admin`,
        correlationId: effectiveCorrelationId,
      });
    }

    return this.handleIdempotency(
      idempotencyKey,
      { id, ...body },
      effectiveCorrelationId,
      () =>
        TenantContext.run(effectiveTenantId, () =>
          this.brandKitService.uploadLogo(id, body, {
            personId: req?.user?.personId,
            role,
            correlationId: effectiveCorrelationId,
          })
        )
    );
  }
}

