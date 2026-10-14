import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ulid } from 'ulid';
import {
  EventBus,
  TenantContext,
  evaluateBrandContrast,
} from '@onebridge/shared';
import { MongoOrganizationRepository } from '../infrastructure/mongo-organization.repository.js';
import { MongoAuditRepository } from '../infrastructure/mongo-audit.repository.js';
import { FakeMediaStorageService } from '../infrastructure/media-storage.service.js';
import {
  BrandKitProps,
  FieldLocksProps,
  UpdateBrandKitDto,
  UpdateFieldLocksDto,
  UploadLogoDto,
} from '../domain/brand-kit.js';

export interface CallerContext {
  personId?: string;
  role?: string;
  correlationId?: string;
}

@Injectable()
export class BrandKitService {
  constructor(
    private readonly orgRepo: MongoOrganizationRepository,
    private readonly auditRepo: MongoAuditRepository,
    private readonly mediaStorageService: FakeMediaStorageService,
    @Inject('EVENT_BUS') private readonly eventBus: EventBus
  ) {}

  async getBrandKit(tenantId: string): Promise<BrandKitProps> {
    const org = await TenantContext.run(tenantId, () => this.orgRepo.findById(tenantId));
    if (!org) {
      throw new NotFoundException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Not Found',
        status: 404,
        detail: `Organization "${tenantId}" not found`,
      });
    }

    if (org.brandKit) {
      return org.brandKit;
    }

    // Default brand kit from org colours/logo or OneBridge defaults
    return {
      logo: org.logo,
      brandColours: {
        band: org.brandColours?.primary || '#1B2A4A',
        accent: org.brandColours?.secondary || '#F68713',
        text: org.brandColours?.accent || '#FFFFFF',
      },
      coverImage: org.cover,
    };
  }

  async updateBrandKit(
    tenantId: string,
    dto: UpdateBrandKitDto,
    context: CallerContext
  ): Promise<BrandKitProps> {
    const correlationId = context.correlationId || 'unknown';
    const actorPersonId = context.personId || 'system';

    const org = await TenantContext.run(tenantId, () => this.orgRepo.findById(tenantId));
    if (!org) {
      throw new NotFoundException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Not Found',
        status: 404,
        detail: `Organization "${tenantId}" not found`,
        correlationId,
      });
    }

    if (!dto.brandColours?.band || !dto.brandColours?.text) {
      throw new BadRequestException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Bad Request',
        status: 400,
        detail: 'brandColours with band and text are required',
        correlationId,
      });
    }

    // AC-4: Contrast validation (WCAG AA 4.5:1)
    const contrastEval = evaluateBrandContrast(dto.brandColours.band, dto.brandColours.text);
    let resolvedText = dto.brandColours.text;

    if (!contrastEval.isAccessible) {
      if (dto.acceptAutoPick === true) {
        resolvedText = contrastEval.autoPickColor;
      } else {
        throw new BadRequestException({
          type: 'https://tools.ietf.org/html/rfc7807',
          title: 'Bad Request',
          status: 400,
          detail: contrastEval.warning,
          correlationId,
        });
      }
    }

    const previousBrandKit = org.brandKit;
    const now = new Date().toISOString();

    const updatedBrandKit: BrandKitProps = {
      logo: dto.logo !== undefined ? dto.logo : org.brandKit?.logo || org.logo,
      brandColours: {
        band: dto.brandColours.band,
        accent: dto.brandColours.accent || org.brandKit?.brandColours.accent || '#F68713',
        text: resolvedText,
      },
      coverImage: dto.coverImage !== undefined ? dto.coverImage : org.brandKit?.coverImage || org.cover,
    };

    const updatedOrg = {
      ...org,
      brandKit: updatedBrandKit,
      // Maintain backward compatibility with top-level properties
      logo: updatedBrandKit.logo,
      cover: updatedBrandKit.coverImage,
      brandColours: {
        primary: updatedBrandKit.brandColours.band,
        secondary: updatedBrandKit.brandColours.accent,
        accent: updatedBrandKit.brandColours.text,
      },
      aggregateVersion: (org.aggregateVersion || 1) + 1,
      updatedAt: now,
    };

    await TenantContext.run(tenantId, () => this.orgRepo.save(updatedOrg));

    // Audit log
    await TenantContext.run(tenantId, () =>
      this.auditRepo.record({
        id: ulid(),
        tenantId,
        action: 'org.brand_updated',
        entityType: 'organization',
        entityId: tenantId,
        actorPersonId,
        before: previousBrandKit as unknown as Record<string, unknown>,
        after: updatedBrandKit as unknown as Record<string, unknown>,
        occurredAt: now,
      })
    );

    // AC-6: Emit org.branding_updated
    await this.eventBus.publish({
      eventId: ulid(),
      type: 'org.branding_updated',
      version: '1.0.0',
      tenantId,
      occurredAt: now,
      correlationId,
      aggregateVersion: updatedOrg.aggregateVersion,
      payload: {
        orgId: tenantId,
        businessId: org.businessId,
        brandKit: updatedBrandKit,
        fieldLocks: { lockedFields: org.fieldLocks || [] },
      },
    });

    return updatedBrandKit;
  }

  async getFieldLocks(tenantId: string): Promise<FieldLocksProps> {
    const org = await TenantContext.run(tenantId, () => this.orgRepo.findById(tenantId));
    if (!org) {
      throw new NotFoundException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Not Found',
        status: 404,
        detail: `Organization "${tenantId}" not found`,
      });
    }

    return {
      lockedFields: org.fieldLocks || [],
    };
  }

  async updateFieldLocks(
    tenantId: string,
    dto: UpdateFieldLocksDto,
    context: CallerContext
  ): Promise<FieldLocksProps> {
    const correlationId = context.correlationId || 'unknown';
    const actorPersonId = context.personId || 'system';

    const org = await TenantContext.run(tenantId, () => this.orgRepo.findById(tenantId));
    if (!org) {
      throw new NotFoundException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Not Found',
        status: 404,
        detail: `Organization "${tenantId}" not found`,
        correlationId,
      });
    }

    if (!Array.isArray(dto.lockedFields)) {
      throw new BadRequestException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Bad Request',
        status: 400,
        detail: 'lockedFields must be an array of field names',
        correlationId,
      });
    }

    const previousLocks = org.fieldLocks || [];
    const now = new Date().toISOString();

    const updatedOrg = {
      ...org,
      fieldLocks: dto.lockedFields,
      aggregateVersion: (org.aggregateVersion || 1) + 1,
      updatedAt: now,
    };

    await TenantContext.run(tenantId, () => this.orgRepo.save(updatedOrg));

    // Audit log
    await TenantContext.run(tenantId, () =>
      this.auditRepo.record({
        id: ulid(),
        tenantId,
        action: 'org.locks_updated',
        entityType: 'organization',
        entityId: tenantId,
        actorPersonId,
        before: { lockedFields: previousLocks },
        after: { lockedFields: dto.lockedFields },
        occurredAt: now,
      })
    );

    // AC-6: Emit org.branding_updated
    await this.eventBus.publish({
      eventId: ulid(),
      type: 'org.branding_updated',
      version: '1.0.0',
      tenantId,
      occurredAt: now,
      correlationId,
      aggregateVersion: updatedOrg.aggregateVersion,
      payload: {
        orgId: tenantId,
        businessId: org.businessId,
        brandKit: org.brandKit || {
          brandColours: {
            band: org.brandColours?.primary || '#1B2A4A',
            accent: org.brandColours?.secondary || '#F68713',
            text: org.brandColours?.accent || '#FFFFFF',
          },
        },
        fieldLocks: { lockedFields: dto.lockedFields },
      },
    });

    return { lockedFields: dto.lockedFields };
  }

  async uploadLogo(tenantId: string, dto: UploadLogoDto, context: CallerContext) {
    return this.mediaStorageService.uploadLogo(tenantId, dto, context.correlationId);
  }
}
