import {
  Controller,
  Get,
  Headers,
  Req,
  ForbiddenException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@onebridge/shared';
import { ProblemError } from '../application/cards.service.js';
import { DashboardService } from '../application/dashboard.service.js';
import { TenantAuthGuard } from './guards/tenant-auth.guard.js';

interface RequestLike {
  user?: { personId?: string; role?: Role; tenantId?: string };
}

function problem(status: number, title: string, detail: string) {
  return { type: 'https://tools.ietf.org/html/rfc7807', title, status, detail };
}

function toHttpException(err: unknown): never {
  if (err instanceof ProblemError) {
    if (err.status === 404) throw new NotFoundException(problem(404, err.title, err.message));
    if (err.status === 403) throw new ForbiddenException(problem(403, err.title, err.message));
  }
  throw err;
}

/** Read-only dashboard queries (card summaries, overview numbers, prototype leads list). */
@Controller()
@UseGuards(TenantAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  private tenantOf(req?: RequestLike, headerTenantId?: string): string {
    const tenantId = headerTenantId || req?.user?.tenantId;
    if (!tenantId) throw new ForbiddenException(problem(403, 'Forbidden', 'Missing tenant context'));
    return tenantId;
  }

  @Get('cards')
  async listCards(@Headers('x-tenant-id') headerTenantId?: string, @Req() req?: RequestLike) {
    return { items: await this.dashboard.listCardSummaries(this.tenantOf(req, headerTenantId)) };
  }

  @Get('stats/overview')
  async overview(@Headers('x-tenant-id') headerTenantId?: string, @Req() req?: RequestLike) {
    return this.dashboard.getOverviewStats(this.tenantOf(req, headerTenantId));
  }

  @Get('leads')
  async listLeads(@Headers('x-tenant-id') headerTenantId?: string, @Req() req?: RequestLike) {
    const tenantId = this.tenantOf(req, headerTenantId);
    try {
      return { items: await this.dashboard.listLeads(tenantId, (req?.user?.role || 'viewer') as Role) };
    } catch (err) {
      toHttpException(err);
    }
  }
}
