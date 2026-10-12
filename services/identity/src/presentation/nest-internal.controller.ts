import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnprocessableEntityException,
} from '@nestjs/common';
import { RbacService } from '../application/rbac.service.js';
import { MembershipProps } from '../domain/membership.js';
import { Role } from '@onebridge/shared';
import { ServiceKeyGuard } from './guards/service-key.guard.js';

@Controller('internal')
@UseGuards(ServiceKeyGuard)
export class NestInternalController {
  constructor(private readonly rbacService: RbacService) {}

  private idempotencyCache = new Map<
    string,
    { value: { requestBody: unknown; response: MembershipProps }; expiresAt: number }
  >();

  @Post('memberships')
  @HttpCode(HttpStatus.CREATED)
  async createMembership(
    @Body()
    body: {
      personId: string;
      orgId: string;
      role: Role;
      branchId?: string;
      departmentId?: string;
      teamId?: string;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId = 'unknown'
  ): Promise<MembershipProps> {
    if (!body || !body.personId || !body.orgId || !body.role) {
      throw new UnprocessableEntityException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'personId, orgId, and role are required fields',
        correlationId,
      });
    }

    if (idempotencyKey) {
      const now = Date.now();
      const cached = this.idempotencyCache.get(idempotencyKey);
      if (cached && cached.expiresAt > now) {
        if (JSON.stringify(cached.value.requestBody) !== JSON.stringify(body)) {
          throw new UnprocessableEntityException({
            type: 'https://tools.ietf.org/html/rfc7807',
            title: 'Unprocessable Entity',
            status: 422,
            detail: 'Mismatching body for idempotency key',
            correlationId,
          });
        }
        return cached.value.response;
      }
    }

    const membership = await this.rbacService.createMembership({
      personId: body.personId,
      orgId: body.orgId,
      role: body.role,
      branchId: body.branchId,
      departmentId: body.departmentId,
      teamId: body.teamId,
    });

    if (idempotencyKey) {
      this.idempotencyCache.set(idempotencyKey, {
        value: { requestBody: body, response: membership },
        expiresAt: Date.now() + 86400 * 1000,
      });
    }

    return membership;
  }
}
