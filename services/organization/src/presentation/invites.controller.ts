import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@onebridge/shared';
import { InviteService } from '../application/invite.service.js';
import { TenantAuthGuard } from './guards/tenant-auth.guard.js';

interface RequestLike {
  user?: { personId?: string; role?: Role; tenantId?: string };
  headers?: Record<string, string | string[] | undefined>;
}

function adminCaller(pathTenantId: string, req?: RequestLike, headerTenantId?: string) {
  const activeTenantId = headerTenantId || req?.user?.tenantId;
  if (!activeTenantId || activeTenantId !== pathTenantId) {
    throw new ForbiddenException({ type: 'https://tools.ietf.org/html/rfc7807', title: 'Forbidden', status: 403, detail: 'Cross-tenant access denied' });
  }
  const role = (req?.user?.role || (req?.headers?.['x-user-role'] as string | undefined) || '').toLowerCase();
  if (role !== 'owner' && role !== 'admin') {
    throw new ForbiddenException({
      type: 'https://tools.ietf.org/html/rfc7807',
      title: 'Forbidden',
      status: 403,
      detail: 'Only the company owner or an admin can invite people.',
    });
  }
  return {
    actorPersonId: req?.user?.personId || (req?.headers?.['x-user-id'] as string) || 'system',
    correlationId: (req?.headers?.['x-correlation-id'] as string) || 'unknown',
  };
}

/** F14 admin endpoints: invite, resend, revoke, list open invites. */
@Controller('orgs/:tenantId')
@UseGuards(TenantAuthGuard)
export class InvitesController {
  constructor(private readonly invites: InviteService) {}

  @Post('seats/:seatId/invite')
  @HttpCode(HttpStatus.CREATED)
  async invite(
    @Param('tenantId') tenantId: string,
    @Param('seatId') seatId: string,
    @Body() body: { channel?: unknown; contact?: unknown },
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    const { actorPersonId, correlationId } = adminCaller(tenantId, req, headerTenantId);
    return this.invites.invite(tenantId, seatId, body ?? {}, actorPersonId, correlationId);
  }

  @Post('seats/:seatId/invite/resend')
  @HttpCode(HttpStatus.CREATED)
  async resend(
    @Param('tenantId') tenantId: string,
    @Param('seatId') seatId: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    const { actorPersonId, correlationId } = adminCaller(tenantId, req, headerTenantId);
    return this.invites.resend(tenantId, seatId, actorPersonId, correlationId);
  }

  @Post('seats/:seatId/invite/revoke')
  @HttpCode(HttpStatus.OK)
  async revoke(
    @Param('tenantId') tenantId: string,
    @Param('seatId') seatId: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Req() req?: RequestLike
  ) {
    const { actorPersonId, correlationId } = adminCaller(tenantId, req, headerTenantId);
    return this.invites.revoke(tenantId, seatId, actorPersonId, correlationId);
  }

  @Get('invites')
  async list(@Param('tenantId') tenantId: string, @Headers('x-tenant-id') headerTenantId?: string, @Req() req?: RequestLike) {
    adminCaller(tenantId, req, headerTenantId);
    return { items: await this.invites.listPending(tenantId) };
  }
}

/** F14 invitee endpoints: preview the invite (no sign-in) and claim it (signed in). */
@Controller('invites')
export class PublicInvitesController {
  constructor(private readonly invites: InviteService) {}

  @Get(':token')
  async preview(@Param('token') token: string) {
    return this.invites.preview(token);
  }

  @Post(':token/claim')
  @HttpCode(HttpStatus.OK)
  @UseGuards(TenantAuthGuard)
  async claim(@Param('token') token: string, @Body() body: { acceptNotice?: unknown; noticeVersion?: unknown }, @Req() req?: RequestLike) {
    const personId = req?.user?.personId;
    if (!personId || personId === 'system') {
      throw new ForbiddenException({ type: 'https://tools.ietf.org/html/rfc7807', title: 'Forbidden', status: 403, detail: 'Sign in to claim this invite.' });
    }
    return this.invites.claim(token, personId, body ?? {}, (req?.headers?.['x-correlation-id'] as string) || 'unknown');
  }
}
