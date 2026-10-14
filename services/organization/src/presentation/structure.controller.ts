import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { Role, CacheStore } from '@onebridge/shared';
import {
  CreateBranchRequest,
  UpdateBranchRequest,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  CreateTeamRequest,
  UpdateTeamRequest,
  MovePersonRequest,
} from '@onebridge/api-contracts';

import { OrgStructureService } from '../application/org-structure.service.js';
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

@Controller('orgs/:tenantId')
@UseGuards(TenantAuthGuard)
export class StructureController {
  private cacheStore: CacheStore;

  constructor(private readonly structureService: OrgStructureService) {
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
  ): { actorPersonId: string; correlationId: string } {
    const activeTenantId = headerTenantId || req?.user?.tenantId;
    if (!activeTenantId || activeTenantId !== pathTenantId) {
      throw new ForbiddenException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: 'Cross-tenant access denied',
      });
    }

    if (requireAdminRole) {
      const role = req?.user?.role ? (req.user.role as string).toLowerCase() : undefined;
      if (!role || (role !== 'owner' && role !== 'admin')) {
        throw new ForbiddenException({
          type: 'https://tools.ietf.org/html/rfc7807',
          title: 'Forbidden',
          status: 403,
          detail: 'Only Organization Owner or Admin can manage organization structure',
        });
      }
    }

    const actorPersonId = req?.user?.personId || (req?.headers?.['x-user-id'] as string) || 'system';
    const correlationId = (req?.headers?.['x-correlation-id'] as string) || 'unknown';

    return { actorPersonId, correlationId };
  }

  // ---------------------------------------------------------------------------
  // BRANCHES
  // ---------------------------------------------------------------------------

  @Get('branches')
  async listBranches(
    @Param('tenantId') tenantId: string,
    @Query('includeArchived') includeArchived?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    this.checkTenantAndRole(tenantId, req, headerTenantId, false);
    const shouldInclude = includeArchived === 'true';
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
    return this.structureService.listBranches(tenantId, shouldInclude, limit, offset);
  }

  @Post('branches')
  @HttpCode(HttpStatus.CREATED)
  async createBranch(
    @Param('tenantId') tenantId: string,
    @Body() body: CreateBranchRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    const { actorPersonId, correlationId } = this.checkTenantAndRole(tenantId, req, headerTenantId, true);
    return this.handleIdempotency(idempotencyKey, body, correlationId, () =>
      this.structureService.createBranch(tenantId, body, actorPersonId, correlationId)
    );
  }

  @Get('branches/:branchId')
  async getBranch(
    @Param('tenantId') tenantId: string,
    @Param('branchId') branchId: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    this.checkTenantAndRole(tenantId, req, headerTenantId, false);
    return this.structureService.getBranch(tenantId, branchId);
  }

  @Patch('branches/:branchId')
  async updateBranch(
    @Param('tenantId') tenantId: string,
    @Param('branchId') branchId: string,
    @Body() body: UpdateBranchRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    const { actorPersonId, correlationId } = this.checkTenantAndRole(tenantId, req, headerTenantId, true);
    return this.handleIdempotency(idempotencyKey, body, correlationId, () =>
      this.structureService.updateBranch(tenantId, branchId, body, actorPersonId, correlationId)
    );
  }

  @Post('branches/:branchId/archive')
  @HttpCode(HttpStatus.OK)
  async archiveBranch(
    @Param('tenantId') tenantId: string,
    @Param('branchId') branchId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    const { actorPersonId, correlationId } = this.checkTenantAndRole(tenantId, req, headerTenantId, true);
    return this.handleIdempotency(idempotencyKey, { branchId }, correlationId, () =>
      this.structureService.archiveBranch(tenantId, branchId, actorPersonId, correlationId)
    );
  }

  // ---------------------------------------------------------------------------
  // DEPARTMENTS
  // ---------------------------------------------------------------------------

  @Get('departments')
  async listDepartments(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId?: string,
    @Query('includeArchived') includeArchived?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    this.checkTenantAndRole(tenantId, req, headerTenantId, false);
    const shouldInclude = includeArchived === 'true';
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
    return this.structureService.listDepartments(tenantId, branchId, shouldInclude, limit, offset);
  }

  @Post('departments')
  @HttpCode(HttpStatus.CREATED)
  async createDepartment(
    @Param('tenantId') tenantId: string,
    @Body() body: CreateDepartmentRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    const { actorPersonId, correlationId } = this.checkTenantAndRole(tenantId, req, headerTenantId, true);
    return this.handleIdempotency(idempotencyKey, body, correlationId, () =>
      this.structureService.createDepartment(tenantId, body, actorPersonId, correlationId)
    );
  }

  @Post('departments/defaults')
  @HttpCode(HttpStatus.CREATED)
  async seedDefaultDepartments(
    @Param('tenantId') tenantId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    const { actorPersonId, correlationId } = this.checkTenantAndRole(tenantId, req, headerTenantId, true);
    return this.handleIdempotency(idempotencyKey, { action: 'seed_defaults' }, correlationId, () =>
      this.structureService.seedDefaultDepartments(tenantId, actorPersonId, correlationId)
    );
  }

  @Get('departments/:departmentId')
  async getDepartment(
    @Param('tenantId') tenantId: string,
    @Param('departmentId') departmentId: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    this.checkTenantAndRole(tenantId, req, headerTenantId, false);
    return this.structureService.getDepartment(tenantId, departmentId);
  }

  @Patch('departments/:departmentId')
  async updateDepartment(
    @Param('tenantId') tenantId: string,
    @Param('departmentId') departmentId: string,
    @Body() body: UpdateDepartmentRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    const { actorPersonId, correlationId } = this.checkTenantAndRole(tenantId, req, headerTenantId, true);
    return this.handleIdempotency(idempotencyKey, body, correlationId, () =>
      this.structureService.updateDepartment(tenantId, departmentId, body, actorPersonId, correlationId)
    );
  }

  @Post('departments/:departmentId/archive')
  @HttpCode(HttpStatus.OK)
  async archiveDepartment(
    @Param('tenantId') tenantId: string,
    @Param('departmentId') departmentId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    const { actorPersonId, correlationId } = this.checkTenantAndRole(tenantId, req, headerTenantId, true);
    return this.handleIdempotency(idempotencyKey, { departmentId }, correlationId, () =>
      this.structureService.archiveDepartment(tenantId, departmentId, actorPersonId, correlationId)
    );
  }

  // ---------------------------------------------------------------------------
  // TEAMS
  // ---------------------------------------------------------------------------

  @Get('teams')
  async listTeams(
    @Param('tenantId') tenantId: string,
    @Query('departmentId') departmentId?: string,
    @Query('includeArchived') includeArchived?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    this.checkTenantAndRole(tenantId, req, headerTenantId, false);
    const shouldInclude = includeArchived === 'true';
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
    return this.structureService.listTeams(tenantId, departmentId, shouldInclude, limit, offset);
  }

  @Post('teams')
  @HttpCode(HttpStatus.CREATED)
  async createTeam(
    @Param('tenantId') tenantId: string,
    @Body() body: CreateTeamRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    const { actorPersonId, correlationId } = this.checkTenantAndRole(tenantId, req, headerTenantId, true);
    return this.handleIdempotency(idempotencyKey, body, correlationId, () =>
      this.structureService.createTeam(tenantId, body, actorPersonId, correlationId)
    );
  }

  @Get('teams/:teamId')
  async getTeam(
    @Param('tenantId') tenantId: string,
    @Param('teamId') teamId: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    this.checkTenantAndRole(tenantId, req, headerTenantId, false);
    const teams = await this.structureService.listTeams(tenantId, undefined, true, 1000, 0);
    const team = teams.items.find((t) => t.id === teamId);
    if (!team) {
      throw new NotFoundException(`Team "${teamId}" not found`);
    }
    return team;
  }

  @Patch('teams/:teamId')
  async updateTeam(
    @Param('tenantId') tenantId: string,
    @Param('teamId') teamId: string,
    @Body() body: UpdateTeamRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    const { actorPersonId, correlationId } = this.checkTenantAndRole(tenantId, req, headerTenantId, true);
    return this.handleIdempotency(idempotencyKey, body, correlationId, () =>
      this.structureService.updateTeam(tenantId, teamId, body, actorPersonId, correlationId)
    );
  }

  @Post('teams/:teamId/archive')
  @HttpCode(HttpStatus.OK)
  async archiveTeam(
    @Param('tenantId') tenantId: string,
    @Param('teamId') teamId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    const { actorPersonId, correlationId } = this.checkTenantAndRole(tenantId, req, headerTenantId, true);
    return this.handleIdempotency(idempotencyKey, { teamId }, correlationId, () =>
      this.structureService.archiveTeam(tenantId, teamId, actorPersonId, correlationId)
    );
  }

  @Delete('teams/:teamId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTeam(
    @Param('tenantId') tenantId: string,
    @Param('teamId') teamId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    const { actorPersonId, correlationId } = this.checkTenantAndRole(tenantId, req, headerTenantId, true);
    await this.handleIdempotency(idempotencyKey, { teamId, delete: true }, correlationId, () =>
      this.structureService.deleteTeam(tenantId, teamId, actorPersonId, correlationId)
    );
  }

  // ---------------------------------------------------------------------------
  // ORG CHART TREE & DRAG-AND-DROP (AC-6)
  // ---------------------------------------------------------------------------

  @Get('tree')
  async getTree(
    @Param('tenantId') tenantId: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    this.checkTenantAndRole(tenantId, req, headerTenantId, false);
    return this.structureService.getTree(tenantId);
  }

  @Post('tree/move-person')
  @HttpCode(HttpStatus.OK)
  async movePersonInTree(
    @Param('tenantId') tenantId: string,
    @Body() body: MovePersonRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    const { actorPersonId, correlationId } = this.checkTenantAndRole(tenantId, req, headerTenantId, true);
    return this.handleIdempotency(idempotencyKey, body, correlationId, () =>
      this.structureService.movePersonInTree(tenantId, body, actorPersonId, correlationId)
    );
  }

  // ---------------------------------------------------------------------------
  // AUDIT LOG (AC-7)
  // ---------------------------------------------------------------------------

  @Get('audit-logs')
  async listAuditLogs(
    @Param('tenantId') tenantId: string,
    @Query('entityType') entityType?: string,
    @Query('limit') limitStr?: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    this.checkTenantAndRole(tenantId, req, headerTenantId, true);
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    return this.structureService.listAuditLogs(tenantId, entityType, limit);
  }
}
