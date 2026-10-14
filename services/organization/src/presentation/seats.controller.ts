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
  HttpCode,
  HttpStatus,
  ForbiddenException,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { Role, CacheStore } from '@onebridge/shared';
import {
  CreateSeatRequest,
  UpdateSeatRequest,
  AssignSeatRequest,
  Seat,
  PaginatedSeats,
} from '@onebridge/api-contracts';
import { SeatsService } from '../application/seats.service.js';
import { TenantAuthGuard } from './guards/tenant-auth.guard.js';
import { InMemoryCacheStore } from './nest-organization.controller.js';

interface RequestLike {
  user?: {
    personId?: string;
    role?: Role;
    tenantId?: string;
  };
  headers?: Record<string, string | string[] | undefined>;
}

@Controller('orgs/:tenantId/seats')
@UseGuards(TenantAuthGuard)
export class SeatsController {
  private cacheStore: CacheStore;

  constructor(private readonly seatsService: SeatsService) {
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

  private checkTenantAndRole(
    pathTenantId: string,
    req?: RequestLike,
    headerTenantId?: string,
    requireAdminRole = false
  ): { actorPersonId: string; correlationId: string; role?: string } {
    const activeTenantId = headerTenantId || req?.user?.tenantId;
    if (!activeTenantId || activeTenantId !== pathTenantId) {
      throw new ForbiddenException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: 'Cross-tenant access denied',
      });
    }

    const role = req?.user?.role
      ? (req.user.role as string).toLowerCase()
      : (req?.headers?.['x-user-role'] as string | undefined)?.toLowerCase();

    if (requireAdminRole) {
      if (!role || (role !== 'owner' && role !== 'admin')) {
        throw new ForbiddenException({
          type: 'https://tools.ietf.org/html/rfc7807',
          title: 'Forbidden',
          status: 403,
          detail: 'Only Organization Owner or Admin can manage seats',
        });
      }
    }

    const actorPersonId = req?.user?.personId || (req?.headers?.['x-user-id'] as string) || 'system';
    const correlationId = (req?.headers?.['x-correlation-id'] as string) || 'unknown';

    return { actorPersonId, correlationId, role };
  }

  @Get()
  async listSeats(
    @Param('tenantId') tenantId: string,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('teamId') teamId?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ): Promise<PaginatedSeats> {
    this.checkTenantAndRole(tenantId, req, headerTenantId, false);
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
    return this.seatsService.listSeats(
      tenantId,
      { status, branchId, departmentId, teamId },
      limit,
      offset
    ) as Promise<PaginatedSeats>;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSeat(
    @Param('tenantId') tenantId: string,
    @Body() body: CreateSeatRequest,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Req() req?: RequestLike
  ): Promise<Seat> {
    const { actorPersonId, correlationId } = this.checkTenantAndRole(tenantId, req, headerTenantId, true);
    return this.handleIdempotency(idempotencyKey, body, correlationId, () =>
      this.seatsService.createSeat(tenantId, body, actorPersonId, correlationId)
    ) as Promise<Seat>;
  }

  @Get(':seatId')
  async getSeat(
    @Param('tenantId') tenantId: string,
    @Param('seatId') seatId: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ): Promise<Seat> {
    this.checkTenantAndRole(tenantId, req, headerTenantId, false);
    return this.seatsService.getSeat(tenantId, seatId) as Promise<Seat>;
  }

  @Patch(':seatId')
  async updateSeat(
    @Param('tenantId') tenantId: string,
    @Param('seatId') seatId: string,
    @Body() body: UpdateSeatRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ): Promise<Seat> {
    const { actorPersonId, correlationId, role } = this.checkTenantAndRole(tenantId, req, headerTenantId, false);
    return this.handleIdempotency(idempotencyKey, body, correlationId, () =>
      this.seatsService.updateSeat(tenantId, seatId, body, actorPersonId, correlationId, role)
    ) as Promise<Seat>;
  }

  @Post(':seatId/assign')
  @HttpCode(HttpStatus.OK)
  async assignSeat(
    @Param('tenantId') tenantId: string,
    @Param('seatId') seatId: string,
    @Body() body: AssignSeatRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ): Promise<Seat> {
    const { actorPersonId, correlationId } = this.checkTenantAndRole(tenantId, req, headerTenantId, true);
    return this.handleIdempotency(idempotencyKey, body, correlationId, () =>
      this.seatsService.assignSeat(tenantId, seatId, body, actorPersonId, correlationId)
    ) as Promise<Seat>;
  }

  @Post(':seatId/archive')
  @HttpCode(HttpStatus.OK)
  async archiveSeat(
    @Param('tenantId') tenantId: string,
    @Param('seatId') seatId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ): Promise<Seat> {
    const { actorPersonId, correlationId } = this.checkTenantAndRole(tenantId, req, headerTenantId, true);
    return this.handleIdempotency(idempotencyKey, { seatId }, correlationId, () =>
      this.seatsService.archiveSeat(tenantId, seatId, actorPersonId, correlationId)
    ) as Promise<Seat>;
  }
}
