import { ulid } from 'ulid';
import { EventBus, TenantContext } from '@onebridge/shared';
import { MongoShortLinkRepository } from '../infrastructure/mongo-short-link.repository.js';
import { MongoCardRepository } from '../infrastructure/mongo-card.repository.js';
import { MongoOrgReadModelRepository, MongoBranchReadModelRepository } from '../infrastructure/mongo-read-model.repositories.js';
import { EdgeShortLinkNotifier } from '../infrastructure/edge-kv-sync.js';
import {
  ShortLinkProps,
  ShortLinkStatus,
  createShortLink,
  repointShortLink,
  updateShortLinkStatus,
  validateDestinationUrl,
} from '../domain/short-link.js';
import {
  generateBrandedQrSvg,
  generateBrandedQrPng,
  generateBrandedQrPdf,
  generateStandeeSvg,
  generateStandeePdf,
} from '../domain/qr-generator.js';

export class ShortLinkError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly title: string,
    message: string
  ) {
    super(message);
    this.name = 'ShortLinkError';
  }
}

export class ShortLinkService {
  constructor(
    private readonly shortLinkRepo: MongoShortLinkRepository,
    private readonly cardRepo: MongoCardRepository,
    private readonly orgRepo: MongoOrgReadModelRepository,
    private readonly branchRepo: MongoBranchReadModelRepository,
    private readonly eventBus: EventBus,
    private readonly edgeNotifier: EdgeShortLinkNotifier,
    private readonly publicBaseUrl = 'https://grid.onebridge.in'
  ) {}

  async ensureDefaultCardShortLink(
    tenantId: string,
    cardId: string,
    cardSlug: string
  ): Promise<ShortLinkProps> {
    return TenantContext.run(tenantId, async () => {
      const existing = await this.shortLinkRepo.findBySource(cardId, 'default');
      if (existing) {
        return existing;
      }

      const destinationUrl = `${this.publicBaseUrl}/${cardSlug}`;
      const shortLink = createShortLink({
        id: ulid(),
        tenantId,
        targetType: 'card',
        targetId: cardId,
        destinationUrl,
        source: 'default',
        label: 'Default Card QR',
        status: 'active',
      });

      const saved = await this.shortLinkRepo.save(shortLink);

      await this.publishShortLinkCreated(saved);
      await this.edgeNotifier.syncShortLink(saved);

      return saved;
    });
  }

  async listCardQrs(tenantId: string, cardId: string): Promise<ShortLinkProps[]> {
    return TenantContext.run(tenantId, async () => {
      const card = await this.cardRepo.findById(cardId);
      if (!card) {
        throw new ShortLinkError(404, 'Not Found', `Card "${cardId}" not found`);
      }
      return this.shortLinkRepo.findByTarget(cardId);
    });
  }

  async getCardQr(tenantId: string, cardId: string, qrId: string): Promise<ShortLinkProps> {
    return TenantContext.run(tenantId, async () => {
      const card = await this.cardRepo.findById(cardId);
      if (!card) {
        throw new ShortLinkError(404, 'Not Found', `Card "${cardId}" not found`);
      }
      const link = await this.shortLinkRepo.findById(qrId);
      if (!link || link.targetId !== cardId) {
        throw new ShortLinkError(404, 'Not Found', `QR code with ID "${qrId}" not found for card "${cardId}"`);
      }
      return link;
    });
  }

  async createCardQr(
    tenantId: string,
    cardId: string,
    source: string,
    label?: string,
    customDestination?: string,
    callerRole?: string,
    callerPersonId?: string,
    defaultSlug?: string
  ): Promise<ShortLinkProps> {
    return TenantContext.run(tenantId, async () => {
      const card = await this.cardRepo.findById(cardId);
      if (!card) {
        throw new ShortLinkError(404, 'Not Found', `Card "${cardId}" not found`);
      }

      if (!source || !source.trim()) {
        throw new ShortLinkError(400, 'Bad Request', 'Source tag is required');
      }

      const existing = await this.shortLinkRepo.findBySource(cardId, source.trim());
      if (existing) {
        throw new ShortLinkError(400, 'Bad Request', `Source tag "${source}" already exists for this card`);
      }

      let destinationUrl = customDestination?.trim();
      if (!destinationUrl) {
        destinationUrl = `${this.publicBaseUrl}/${defaultSlug || card.slug || cardId}`;
      } else {
        const validation = validateDestinationUrl(destinationUrl, {
          allowExternal: callerRole === 'owner' || callerRole === 'admin',
          callerRole,
        });

        if (!validation.isValid) {
          const status = validation.reason?.includes('Company Admin approval') ? 403 : 400;
          throw new ShortLinkError(status, status === 403 ? 'Forbidden' : 'Bad Request', validation.reason || 'Invalid destination URL');
        }
      }

      const shortLink = createShortLink({
        id: ulid(),
        tenantId,
        targetType: 'card',
        targetId: cardId,
        destinationUrl,
        source: source.trim(),
        label: label?.trim(),
        callerRole,
        approvedBy: callerPersonId,
      });

      const saved = await this.shortLinkRepo.save(shortLink);

      await this.publishShortLinkCreated(saved);
      await this.edgeNotifier.syncShortLink(saved);

      return saved;
    });
  }

  async repointShortLink(
    tenantId: string,
    cardId: string,
    qrId: string,
    options: {
      destinationUrl?: string;
      label?: string;
      status?: ShortLinkStatus;
      callerRole?: string;
      callerPersonId?: string;
    }
  ): Promise<ShortLinkProps> {
    return TenantContext.run(tenantId, async () => {
      const card = await this.cardRepo.findById(cardId);
      if (!card) {
        throw new ShortLinkError(404, 'Not Found', `Card "${cardId}" not found`);
      }

      const current = await this.shortLinkRepo.findById(qrId);
      if (!current || current.targetId !== cardId) {
        throw new ShortLinkError(404, 'Not Found', `QR code with ID "${qrId}" not found for card "${cardId}"`);
      }

      let updated = current;

      if (options.destinationUrl && options.destinationUrl.trim() !== current.destinationUrl) {
        const newUrl = options.destinationUrl.trim();
        const validation = validateDestinationUrl(newUrl, {
          allowExternal: options.callerRole === 'owner' || options.callerRole === 'admin',
          callerRole: options.callerRole,
        });

        if (!validation.isValid) {
          const status = validation.reason?.includes('Company Admin approval') ? 403 : 400;
          throw new ShortLinkError(status, status === 403 ? 'Forbidden' : 'Bad Request', validation.reason || 'Invalid destination URL');
        }

        const prevUrl = current.destinationUrl;
        updated = repointShortLink(updated, newUrl, options.callerPersonId || 'admin');

        await this.eventBus.publish({
          eventId: ulid(),
          type: 'shortlink.repointed',
          version: '1.0.0',
          tenantId,
          occurredAt: updated.updatedAt,
          correlationId: `repoint_${qrId}`,
          aggregateVersion: updated.aggregateVersion,
          payload: {
            shortLinkId: updated.id,
            code: updated.code,
            previousDestinationUrl: prevUrl,
            newDestinationUrl: updated.destinationUrl,
            repointedAt: updated.updatedAt,
            repointedBy: options.callerPersonId || 'admin',
          },
        });
      }

      if (options.status && options.status !== updated.status) {
        const prevStatus = updated.status;
        updated = updateShortLinkStatus(updated, options.status);

        await this.eventBus.publish({
          eventId: ulid(),
          type: 'shortlink.status_changed',
          version: '1.0.0',
          tenantId,
          occurredAt: updated.updatedAt,
          correlationId: `status_${qrId}`,
          aggregateVersion: updated.aggregateVersion,
          payload: {
            shortLinkId: updated.id,
            code: updated.code,
            previousStatus: prevStatus,
            newStatus: updated.status,
            reason: options.status === 'disabled' ? 'Disabled by user' : undefined,
          },
        });
      }

      if (options.label !== undefined) {
        updated = { ...updated, label: options.label };
      }

      const saved = await this.shortLinkRepo.save(updated);
      await this.edgeNotifier.syncShortLink(saved);

      return saved;
    });
  }

  async resolveShortLinkByCode(code: string): Promise<ShortLinkProps | null> {
    return this.shortLinkRepo.findByCodeGlobal(code);
  }

  async generateQrAsset(
    tenantId: string,
    cardId: string,
    qrId: string,
    format: 'png' | 'svg' | 'pdf',
    size = 1000
  ): Promise<{ content: Buffer | string; contentType: string }> {
    const link = await this.getCardQr(tenantId, cardId, qrId);
    const org = await TenantContext.run(tenantId, () => this.orgRepo.findByTenantId(tenantId));

    const brandColours = {
      band: org?.brandColours?.band || '#1B2A4A',
      accent: org?.brandColours?.accent || '#F68713',
      text: org?.brandColours?.text || '#FFFFFF',
    };

    const logoUrl = org?.logo;
    const targetUrl = link.shortUrl;

    if (format === 'svg') {
      const svg = await generateBrandedQrSvg({ url: targetUrl, brandColours, logoUrl, size });
      return { content: svg, contentType: 'image/svg+xml' };
    }

    if (format === 'png') {
      const pngBuffer = await generateBrandedQrPng({ url: targetUrl, brandColours, logoUrl, size });
      return { content: pngBuffer, contentType: 'image/png' };
    }

    const pdfBuffer = await generateBrandedQrPdf({ url: targetUrl, brandColours, logoUrl, size });
    return { content: pdfBuffer, contentType: 'application/pdf' };
  }

  async generateStandeeAsset(
    tenantId: string,
    branchId: string | undefined,
    templateSize: 'a4' | 'a5',
    format: 'pdf' | 'svg'
  ): Promise<{ content: Buffer | string; contentType: string }> {
    const org = await TenantContext.run(tenantId, () => this.orgRepo.findByTenantId(tenantId));
    if (!org) {
      throw new ShortLinkError(404, 'Not Found', `Organization "${tenantId}" not found`);
    }

    let branchName: string | undefined;
    if (branchId) {
      const branch = await TenantContext.run(tenantId, () => this.branchRepo.findByBranchId(branchId));
      branchName = branch?.name;
    }

    const brandColours = {
      band: org.brandColours?.band || '#1B2A4A',
      accent: org.brandColours?.accent || '#F68713',
      text: org.brandColours?.text || '#FFFFFF',
    };

    const targetUrl = `${this.publicBaseUrl}/${org.slug}${branchId ? `/branches/${branchId}` : ''}`;
    const companyName = org.name;

    if (format === 'svg') {
      const svg = await generateStandeeSvg({
        url: targetUrl,
        companyName,
        branchName,
        brandColours,
        logoUrl: org.logo,
        templateSize,
      });
      return { content: svg, contentType: 'image/svg+xml' };
    }

    const pdfBuffer = await generateStandeePdf({
      url: targetUrl,
      companyName,
      branchName,
      brandColours,
      logoUrl: org.logo,
      templateSize,
    });
    return { content: pdfBuffer, contentType: 'application/pdf' };
  }

  private async publishShortLinkCreated(link: ShortLinkProps): Promise<void> {
    await this.eventBus.publish({
      eventId: ulid(),
      type: 'shortlink.created',
      version: '1.0.0',
      tenantId: link.tenantId,
      occurredAt: link.createdAt,
      correlationId: `create_shortlink_${link.id}`,
      aggregateVersion: link.aggregateVersion,
      payload: {
        shortLinkId: link.id,
        code: link.code,
        targetType: link.targetType,
        targetId: link.targetId,
        destinationUrl: link.destinationUrl,
        source: link.source,
        status: link.status,
      },
    });
  }
}
