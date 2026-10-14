import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  NotFoundException,
} from '@nestjs/common';
import { ulid } from 'ulid';
import {
  EventBus,
  Role,
  TenantContext,
  generateBase32BusinessId,
  validateSlug,
  slugifyCompanyName,
} from '@onebridge/shared';
import { OrganizationProps } from '../domain/organization.js';
import { validateGstin } from '../domain/gstin-validator.js';
import { MongoOrganizationRepository } from '../infrastructure/mongo-organization.repository.js';
import { MongoIssuedIdRepository } from '../infrastructure/mongo-issued-id.repository.js';
import { IdentityInternalClient } from '../infrastructure/identity-internal.client.js';

import { CounterService } from './counter.service.js';
import { CounterType } from '../domain/counter.js';

export interface CreateOrganizationDto {
  name: string;
  creatorPersonId: string;
  legalName?: string;
  industry: string;
  size: string;
  city: string;
  gstin?: string;
  slug?: string;
  plan?: 'starter' | 'business';
  website?: string;
  idempotencyKey?: string;
  correlationId?: string;
}

export interface UpdateOrganizationDto {
  name?: string;
  legalName?: string;
  logo?: string;
  cover?: string;
  brandColours?: { primary: string; secondary?: string; accent?: string };
  industry?: string;
  size?: string;
  about?: string;
  website?: string;
  addresses?: OrganizationProps['addresses'];
  gstin?: string;
  socialLinks?: Record<string, string>;
  slug?: string;
  correlationId?: string;
}

export interface CallerContext {
  personId?: string;
  role?: Role;
  correlationId?: string;
}

@Injectable()
export class OrganizationService {
  constructor(
    private readonly orgRepo: MongoOrganizationRepository,
    private readonly issuedIdRepo: MongoIssuedIdRepository,
    private readonly identityClient: IdentityInternalClient,
    private readonly eventBus: EventBus,
    private readonly counterService?: CounterService
  ) {}

  /**
   * Generates next derived ID (branch, department, seat) for the organization.
   * Per F03 AC-4: <BusinessID>-B03, -D07, -E0142.
   */
  async generateDerivedId(tenantId: string, type: CounterType): Promise<string> {
    if (!this.counterService) {
      throw new Error('CounterService is not configured in OrganizationService');
    }
    return this.counterService.generateDerivedId(tenantId, type);
  }

  /**
   * AC-1, AC-2, AC-6: Register new company, mint tenantId & businessId, create Owner membership.
   */
  async createOrganization(dto: CreateOrganizationDto): Promise<OrganizationProps> {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('Company display name is required');
    }
    if (!dto.industry || !dto.industry.trim()) {
      throw new BadRequestException('Industry is required');
    }
    if (!dto.size || !dto.size.trim()) {
      throw new BadRequestException('Company size is required');
    }
    if (!dto.city || !dto.city.trim()) {
      throw new BadRequestException('City is required');
    }
    if (!dto.creatorPersonId || !dto.creatorPersonId.trim()) {
      throw new BadRequestException('Creator person ID is required');
    }

    // Validate GSTIN if provided
    if (dto.gstin && dto.gstin.trim()) {
      const gstinVal = validateGstin(dto.gstin);
      if (!gstinVal.isValid) {
        throw new BadRequestException(gstinVal.reason);
      }
    }

    // Determine slug
    const targetSlug = dto.slug && dto.slug.trim() ? dto.slug.trim().toLowerCase() : slugifyCompanyName(dto.name);
    const slugCheck = validateSlug(targetSlug);
    if (!slugCheck.isValid) {
      throw new BadRequestException(slugCheck.reason);
    }

    // Check slug uniqueness
    const existingWithSlug = await this.orgRepo.findByAnySlug(targetSlug);
    if (existingWithSlug) {
      throw new ConflictException(`Slug "${targetSlug}" is already taken`);
    }

    // 1. Generate opaque tenantId (ULID)
    const tenantId = ulid();

    // 2. Mint Business ID with retry on collision (ADR-0001)
    let businessId = '';
    let claimed = false;
    const maxRetries = 5;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const candidateId = generateBase32BusinessId();
      const success = await this.issuedIdRepo.claimId(candidateId, tenantId);
      if (success) {
        businessId = candidateId;
        claimed = true;
        break;
      }
    }

    if (!claimed) {
      throw new ServiceUnavailableException('Business ID generation exhausted collision retry budget');
    }

    // 3. Create Owner membership synchronously in Identity (ADR-0001)
    try {
      await this.identityClient.createMembership({
        personId: dto.creatorPersonId,
        orgId: tenantId,
        role: 'owner',
        idempotencyKey: dto.idempotencyKey,
        correlationId: dto.correlationId,
      });
    } catch (err: unknown) {
      // Rollback: void the claimed Business ID and abort
      await this.issuedIdRepo.voidId(businessId);
      const msg = err instanceof Error ? err.message : String(err);
      throw new ServiceUnavailableException(
        `Service Unavailable: Failed to create Owner membership in Identity service: ${msg}`
      );
    }

    const now = new Date().toISOString();
    const orgDoc: OrganizationProps = {
      id: tenantId,
      tenantId,
      businessId,
      name: dto.name.trim(),
      legalName: dto.legalName?.trim() || dto.name.trim(),
      slug: targetSlug,
      previousSlugs: [],
      industry: dto.industry.trim(),
      size: dto.size.trim(),
      city: dto.city.trim(),
      website: dto.website?.trim(),
      gstin: dto.gstin?.trim()?.toUpperCase(),
      plan: dto.plan || 'starter',
      verifiedBadge: false,
      onboardingStartedAt: now,
      aggregateVersion: 1,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await TenantContext.run(tenantId, () => this.orgRepo.save(orgDoc));

    // 4. Emit org.created domain event (ADR-0003)
    await this.eventBus.publish({
      eventId: ulid(),
      type: 'org.created',
      version: '1.0.0',
      tenantId,
      occurredAt: now,
      correlationId: dto.correlationId || 'unknown',
      aggregateVersion: 1,
      payload: {
        orgId: saved.id,
        businessId: saved.businessId,
        creatorPersonId: dto.creatorPersonId,
        name: saved.name,
        slug: saved.slug,
      },
    });

    return saved;
  }

  async getOrganization(orgId: string): Promise<OrganizationProps> {
    const org = await this.orgRepo.findById(orgId);
    if (!org) {
      throw new NotFoundException(`Organization with ID "${orgId}" not found`);
    }
    return org;
  }

  /**
   * AC-3, AC-4, AC-6: Update profile, branding, slug with 301 history, and role checking.
   */
  async updateOrganization(
    orgId: string,
    dto: UpdateOrganizationDto,
    callerContext?: CallerContext
  ): Promise<OrganizationProps> {
    // Role check: Only Owner or Admin can update org profile
    if (callerContext?.role) {
      if (callerContext.role !== 'owner' && callerContext.role !== 'admin') {
        throw new ForbiddenException('Forbidden: Only Company Owner or Company Admin can edit company profile');
      }
    }

    const existing = await this.orgRepo.findById(orgId);
    if (!existing) {
      throw new NotFoundException(`Organization with ID "${orgId}" not found`);
    }

    // Validate GSTIN if provided
    if (dto.gstin !== undefined) {
      if (dto.gstin.trim() !== '') {
        const gstinVal = validateGstin(dto.gstin);
        if (!gstinVal.isValid) {
          throw new BadRequestException(gstinVal.reason);
        }
      }
    }

    const previousSlugs = [...existing.previousSlugs];
    let newSlug = existing.slug;

    // Slug update & uniqueness check
    if (dto.slug && dto.slug.trim() !== '' && dto.slug.trim().toLowerCase() !== existing.slug) {
      const candidateSlug = dto.slug.trim().toLowerCase();
      const slugCheck = validateSlug(candidateSlug);
      if (!slugCheck.isValid) {
        throw new BadRequestException(slugCheck.reason);
      }

      const conflictOrg = await this.orgRepo.findByAnySlug(candidateSlug);
      if (conflictOrg && conflictOrg.id !== orgId) {
        throw new ConflictException(`Slug "${candidateSlug}" is already in use by another company`);
      }

      // Add old slug to previousSlugs for permanent 301 redirect (AC-6)
      if (!previousSlugs.includes(existing.slug)) {
        previousSlugs.push(existing.slug);
      }
      newSlug = candidateSlug;
    }

    // Check if branding fields changed (AC-4)
    const brandingChanged =
      dto.brandColours !== undefined ||
      dto.logo !== undefined ||
      dto.cover !== undefined;

    const now = new Date().toISOString();
    const updatedDoc: OrganizationProps = {
      ...existing,
      name: dto.name?.trim() ?? existing.name,
      legalName: dto.legalName?.trim() ?? existing.legalName,
      logo: dto.logo ?? existing.logo,
      cover: dto.cover ?? existing.cover,
      brandColours: dto.brandColours ?? existing.brandColours,
      industry: dto.industry?.trim() ?? existing.industry,
      size: dto.size?.trim() ?? existing.size,
      about: dto.about?.trim() ?? existing.about,
      website: dto.website?.trim() ?? existing.website,
      addresses: dto.addresses ?? existing.addresses,
      gstin: dto.gstin !== undefined ? (dto.gstin.trim() || undefined) : existing.gstin,
      socialLinks: dto.socialLinks ?? existing.socialLinks,
      slug: newSlug,
      previousSlugs,
      aggregateVersion: existing.aggregateVersion + 1,
      updatedAt: now,
    };

    const saved = await this.orgRepo.save(updatedDoc);
    const effectiveCorrelationId = callerContext?.correlationId || dto.correlationId || 'unknown';

    // Emit org.updated event
    await this.eventBus.publish({
      eventId: ulid(),
      type: 'org.updated',
      version: '1.0.0',
      tenantId: orgId,
      occurredAt: now,
      correlationId: effectiveCorrelationId,
      aggregateVersion: saved.aggregateVersion,
      payload: {
        orgId: saved.id,
        businessId: saved.businessId,
        updatedFields: dto,
      },
    });

    // Emit org.branding_updated event if branding changed (AC-4: within 60s card propagation)
    if (brandingChanged) {
      await this.eventBus.publish({
        eventId: ulid(),
        type: 'org.branding_updated',
        version: '1.0.0',
        tenantId: orgId,
        occurredAt: now,
        correlationId: effectiveCorrelationId,
        aggregateVersion: saved.aggregateVersion,
        payload: {
          orgId: saved.id,
          businessId: saved.businessId,
          brandColours: saved.brandColours,
          logo: saved.logo,
          cover: saved.cover,
        },
      });
    }

    return saved;
  }

  /**
   * AC-6: Resolve slug with permanent 301 redirection for previous slugs.
   */
  async resolveSlug(slug: string): Promise<{
    status: 200 | 301 | 404;
    organization?: OrganizationProps;
    redirectToSlug?: string;
  }> {
    const normalized = slug.trim().toLowerCase();
    const org = await this.orgRepo.findByAnySlug(normalized);
    if (!org) {
      return { status: 404 };
    }

    if (org.slug === normalized) {
      return { status: 200, organization: org };
    }

    if (org.previousSlugs && org.previousSlugs.includes(normalized)) {
      return { status: 301, redirectToSlug: org.slug };
    }

    return { status: 404 };
  }

  /**
   * AC-7: Target tracking: first card live in under 10 minutes (median).
   */
  async recordFirstCardPublished(orgId: string): Promise<OrganizationProps> {
    const org = await this.orgRepo.findById(orgId);
    if (!org) {
      throw new NotFoundException(`Organization with ID "${orgId}" not found`);
    }

    if (org.firstCardCreatedAt) {
      return org;
    }

    const now = new Date();
    const started = new Date(org.onboardingStartedAt);
    const durationSeconds = Math.max(0, Math.round((now.getTime() - started.getTime()) / 1000));

    const updated: OrganizationProps = {
      ...org,
      firstCardCreatedAt: now.toISOString(),
      timeToFirstCardSeconds: durationSeconds,
      updatedAt: now.toISOString(),
      aggregateVersion: org.aggregateVersion + 1,
    };

    return this.orgRepo.save(updated);
  }
}
