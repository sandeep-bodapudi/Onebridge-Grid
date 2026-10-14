import {
  Controller,
  Get,
  Param,
  Query,
  Headers,
  Req,
  Res,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { ulid } from 'ulid';
import { Role } from '@onebridge/shared';
import { AuditLogService } from '../application/audit-log.service.js';
import { TenantAuthGuard } from './guards/tenant-auth.guard.js';

export interface AuditHttpResponse {
  status(code: number): this;
  setHeader(name: string, value: string): this;
}

export interface AuditRequestLike {
  user?: {
    personId?: string;
    role?: Role;
    tenantId?: string;
  };
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}

export function extractClientIp(req?: AuditRequestLike): string {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  const cfIp = req?.headers?.['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.length > 0) {
    return cfIp.trim();
  }
  const rawIp = req?.ip;
  if (typeof rawIp === 'string' && rawIp.length > 0) {
    return rawIp;
  }
  return '127.0.0.1';
}

@Controller('orgs')
@UseGuards(TenantAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditLogService) {}

  private checkScope(
    id: string,
    req?: AuditRequestLike,
    tenantIdHeader?: string,
    roleHeader?: string,
    correlationIdHeader?: string
  ): { tenantId: string; actor: string; correlationId: string } {
    const effectiveCorrelationId =
      correlationIdHeader || (req?.headers?.['x-correlation-id'] as string) || ulid();
    const effectiveTenantId = tenantIdHeader || req?.user?.tenantId;

    if (!effectiveTenantId || effectiveTenantId !== id) {
      throw new ForbiddenException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: `Access denied: Caller tenant "${effectiveTenantId || 'none'}" cannot access audit logs for organization "${id}"`,
        correlationId: effectiveCorrelationId,
      });
    }

    const role = (roleHeader as Role) || req?.user?.role;
    if (!role || (role !== 'owner' && role !== 'admin')) {
      throw new ForbiddenException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: `Access denied: Role "${role || 'none'}" cannot access audit logs. Required: owner or admin`,
        correlationId: effectiveCorrelationId,
      });
    }

    const actor = req?.user?.personId || 'system';
    return { tenantId: effectiveTenantId, actor, correlationId: effectiveCorrelationId };
  }

  // AC-3: Filter by actor, action, entity, and date
  @Get(':id/audit')
  async listAuditLogs(
    @Param('id') id: string,
    @Query('actor') actor?: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
    @Headers('x-tenant-id') tenantIdHeader?: string,
    @Headers('x-user-role') roleHeader?: string,
    @Headers('x-correlation-id') correlationIdHeader?: string,
    @Req() req?: AuditRequestLike
  ) {
    const { tenantId } = this.checkScope(id, req, tenantIdHeader, roleHeader, correlationIdHeader);

    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;

    const result = await this.auditService.listAuditLogs(tenantId, {
      actor,
      action,
      entity,
      startDate,
      endDate,
      limit,
      offset,
    });

    return {
      items: result.entries,
      entries: result.entries,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    };
  }

  // AC-3: Export to CSV (both audit:export AIP-136 custom method and audit/export REST format)
  @Get([':id/audit\\:export', ':id/audit/export'])
  async exportAuditLogs(
    @Param('id') id: string,
    @Query('actor') actor?: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Headers('x-tenant-id') tenantIdHeader?: string,
    @Headers('x-user-role') roleHeader?: string,
    @Headers('x-correlation-id') correlationIdHeader?: string,
    @Req() req?: AuditRequestLike,
    @Res({ passthrough: true }) res?: AuditHttpResponse
  ): Promise<string> {
    const { tenantId } = this.checkScope(id, req, tenantIdHeader, roleHeader, correlationIdHeader);

    if (res) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${id}.csv"`);
    }

    return this.auditService.exportAuditLogsCsv(tenantId, {
      actor,
      action,
      entity,
      startDate,
      endDate,
    });
  }
}
