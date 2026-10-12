import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { RbacService, MeResult } from '../application/rbac.service.js';
import { TokenService } from '../application/token.service.js';

@Controller('me')
export class NestMeController {
  constructor(
    private readonly rbacService: RbacService,
    private readonly tokenService: TokenService
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getMe(
    @Headers('authorization') authHeader?: string,
    @Headers('x-tenant-id') activeTenantHeader?: string,
    @Headers('x-correlation-id') correlationId = 'unknown'
  ): Promise<MeResult> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Unauthorized',
        status: 401,
        detail: 'Missing or invalid Authorization header',
        correlationId,
      });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = this.tokenService.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Unauthorized',
        status: 401,
        detail: 'Expired or invalid access token',
        correlationId,
      });
    }

    const userId = (decoded.sub || decoded.userId) as string;
    return this.rbacService.getMe(userId, activeTenantHeader, correlationId);
  }
}
