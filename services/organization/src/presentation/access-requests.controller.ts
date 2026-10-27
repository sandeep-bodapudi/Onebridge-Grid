import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@onebridge/shared';
import { AccessRequestService } from '../application/access-request.service.js';
import { TenantAuthGuard } from './guards/tenant-auth.guard.js';

interface RequestLike {
  user?: { personId?: string; role?: Role; tenantId?: string };
  headers?: Record<string, string | string[] | undefined>;
}

function member(pathTenantId: string, req?: RequestLike, headerTenantId?: string) {
  const active = headerTenantId || req?.user?.tenantId;
  if (!active || active !== pathTenantId || !req?.user?.role) {
    throw new ForbiddenException({ type: 'https://tools.ietf.org/html/rfc7807', title: 'Forbidden', status: 403, detail: 'Cross-tenant access denied' });
  }
  return { role: String(req.user.role).toLowerCase(), personId: req.user.personId || 'system' };
}

/** N02: plan usage and access requests. */
@Controller('orgs')
@UseGuards(TenantAuthGuard)
export class AccessRequestsController {
  constructor(private readonly service: AccessRequestService) {}

  @Post('access-requests')
  @HttpCode(HttpStatus.ACCEPTED)
  async request(@Body() body: { gstin?: unknown; name?: unknown; message?: unknown }, @Req() req?: RequestLike) {
    const personId = req?.user?.personId;
    if (!personId || personId === 'system') {
      throw new ForbiddenException({ type: 'https://tools.ietf.org/html/rfc7807', title: 'Forbidden', status: 403, detail: 'Sign in to request access.' });
    }
    await this.service.request(personId, body ?? {});
    return { status: 'sent', detail: 'If this company is on OneBridge Grid, its owner will see your request.' };
  }

  @Get(':orgId/access-requests')
  async list(@Param('orgId') orgId: string, @Headers('x-tenant-id') headerTenantId?: string, @Req() req?: RequestLike) {
    const { role } = member(orgId, req, headerTenantId);
    return { items: await this.service.listPending(orgId, role) };
  }

  @Post(':orgId/access-requests/:requestId/decide')
  @HttpCode(HttpStatus.OK)
  async decide(
    @Param('orgId') orgId: string,
    @Param('requestId') requestId: string,
    @Body() body: { decision?: unknown; role?: unknown },
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    const { role, personId } = member(orgId, req, headerTenantId);
    return this.service.decide(orgId, requestId, body ?? {}, role, personId);
  }

  @Get(':orgId/limits')
  async limits(@Param('orgId') orgId: string, @Headers('x-tenant-id') headerTenantId?: string, @Req() req?: RequestLike) {
    member(orgId, req, headerTenantId);
    return this.service.limits(orgId);
  }
}
