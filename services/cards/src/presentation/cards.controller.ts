import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Headers,
  Req,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@onebridge/shared';
import { CardsService, ProblemError, UpdateCardDto } from '../application/cards.service.js';
import { listCardTemplates } from '../application/card-templates.js';
import { TenantAuthGuard } from './guards/tenant-auth.guard.js';

interface RequestLike {
  user?: { personId?: string; role?: Role; tenantId?: string };
  headers?: Record<string, string | string[] | undefined>;
}

function toHttpException(err: unknown): never {
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
  throw err;
}

// No @Controller() prefix: routes are spelled out in full below, because
// F10/F11's API shape uses a literal colon directly after "cards" with no
// slash (e.g. POST /cards:bulk-template), which Nest's automatic
// prefix-joining cannot produce. Matches the escaped-colon-route pattern
// already used in services/organization/src/presentation/audit.controller.ts.
@Controller()
@UseGuards(TenantAuthGuard)
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  private requireCaller(req?: RequestLike, headerTenantId?: string) {
    const tenantId = headerTenantId || req?.user?.tenantId;
    const personId = req?.user?.personId || (req?.headers?.['x-user-id'] as string) || 'system';
    const role = (req?.user?.role || (req?.headers?.['x-user-role'] as Role) || 'viewer') as Role;
    const correlationId = (req?.headers?.['x-correlation-id'] as string) || 'unknown';
    if (!tenantId) {
      throw new ForbiddenException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: 'Missing tenant context',
      });
    }
    return { tenantId, personId, role, correlationId };
  }

  @Get('cards/templates')
  listTemplates() {
    return { items: listCardTemplates() };
  }

  @Get('cards/:cardId')
  async getCard(
    @Param('cardId') cardId: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    const { tenantId } = this.requireCaller(req, headerTenantId);
    try {
      return await this.cardsService.getCard(tenantId, cardId);
    } catch (err) {
      toHttpException(err);
    }
  }

  @Patch('cards/:cardId')
  async updateCard(
    @Param('cardId') cardId: string,
    @Body() body: UpdateCardDto,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    const { tenantId, personId, role, correlationId } = this.requireCaller(req, headerTenantId);
    try {
      return await this.cardsService.updateCard(tenantId, cardId, body, { personId, role, correlationId });
    } catch (err) {
      toHttpException(err);
    }
  }

  @Post(['cards/:cardId\\:publish', 'cards/:cardId/publish'])
  async publishCard(
    @Param('cardId') cardId: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    const { tenantId, personId, role, correlationId } = this.requireCaller(req, headerTenantId);
    try {
      return await this.cardsService.publishCard(tenantId, cardId, { personId, role, correlationId }, correlationId);
    } catch (err) {
      toHttpException(err);
    }
  }

  @Post(['cards/:cardId\\:approve', 'cards/:cardId/approve'])
  async approveCard(
    @Param('cardId') cardId: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    const { tenantId, personId, role, correlationId } = this.requireCaller(req, headerTenantId);
    try {
      return await this.cardsService.approveCard(tenantId, cardId, { personId, role, correlationId }, correlationId);
    } catch (err) {
      toHttpException(err);
    }
  }

  @Post(['cards\\:bulk-template', 'cards/bulk-template'])
  async bulkSetTemplate(
    @Body() body: { cardIds: string[]; templateId: string },
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    const { tenantId, personId, role, correlationId } = this.requireCaller(req, headerTenantId);
    try {
      return await this.cardsService.bulkSetTemplate(
        tenantId,
        body.cardIds,
        body.templateId as unknown as Parameters<CardsService['bulkSetTemplate']>[2],
        { personId, role, correlationId }
      );
    } catch (err) {
      toHttpException(err);
    }
  }
}
