import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Headers,
  Inject,
} from '@nestjs/common';
export interface HttpRequest {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
  [key: string]: unknown;
}

export interface HttpResponse {
  cookie(name: string, value: string, options?: Record<string, unknown>): this;
  clearCookie(name: string, options?: Record<string, unknown>): this;
  [key: string]: unknown;
}
import { ProblemException } from '@onebridge/shared';
import { AuthService } from '../application/auth.service.js';
import { MfaService } from '../application/mfa.service.js';
import { getRefreshTokenCookieOptions } from '../config/cookie.config.js';
import { IdentityEnvConfig } from '../config/env.js';

function getClientUserAgent(req?: HttpRequest): string {
  const ua = req?.headers?.['user-agent'];
  if (typeof ua === 'string') return ua;
  if (Array.isArray(ua)) return ua[0] || 'Unknown';
  return 'Unknown';
}

function getClientIp(req?: HttpRequest): string {
  const fwd = req?.headers?.['x-forwarded-for'];
  const raw = req?.ip || (typeof fwd === 'string' ? fwd : Array.isArray(fwd) ? fwd[0] : undefined) || '127.0.0.1';
  return raw.split(',')[0].trim();
}

function extractBearer(header?: string): string {
  if (!header) return '';
  return header.startsWith('Bearer ') ? header.substring(7) : header;
}

@Controller('auth')
export class NestAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
    @Inject('IDENTITY_ENV_CONFIG') private readonly envConfig: IdentityEnvConfig
  ) {}

  @Post('otp')
  @HttpCode(HttpStatus.OK)
  async requestOtp(
    @Body() body: { phone: string },
    @Headers('x-correlation-id') _correlationId?: string,
    @Req() req?: HttpRequest
  ) {
    const ip = getClientIp(req);
    const result = await this.authService.requestOtp(body.phone, ip);
    return {
      message: result.message,
      cooldownSeconds: result.cooldownSeconds,
    };
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() body: { phone: string; code: string; deviceLabel?: string },
    @Res({ passthrough: true }) res: HttpResponse,
    @Req() req?: HttpRequest
  ) {
    const ip = getClientIp(req);
    const userAgent = getClientUserAgent(req);
    const result = await this.authService.verifyOtp(
      body.phone,
      body.code,
      body.deviceLabel || userAgent,
      ip
    );

    if (result.refreshToken) {
      const cookieOpts = getRefreshTokenCookieOptions(
        this.envConfig.cookieSecure,
        this.envConfig.cookieDomain
      );
      res.cookie('refreshToken', result.refreshToken, cookieOpts);
    }

    return {
      status: result.status,
      accessToken: result.accessToken,
      mfaTicket: result.mfaTicket,
    };
  }

  @Post('oauth/:provider')
  @HttpCode(HttpStatus.OK)
  async oauthLogin(
    @Param('provider') provider: 'google' | 'microsoft',
    @Body() body: { idToken: string; deviceLabel?: string },
    @Res({ passthrough: true }) res: HttpResponse,
    @Req() req?: HttpRequest
  ) {
    const ip = getClientIp(req);
    const userAgent = getClientUserAgent(req);
    const result = await this.authService.loginWithOAuth(
      provider,
      body.idToken,
      body.deviceLabel || userAgent,
      ip
    );

    if (result.refreshToken) {
      const cookieOpts = getRefreshTokenCookieOptions(
        this.envConfig.cookieSecure,
        this.envConfig.cookieDomain
      );
      res.cookie('refreshToken', result.refreshToken, cookieOpts);
    }

    return {
      status: result.status,
      accessToken: result.accessToken,
      mfaTicket: result.mfaTicket,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: HttpRequest,
    @Res({ passthrough: true }) res: HttpResponse
  ) {
    const oldRefreshToken = req.cookies?.refreshToken;
    const correlationId = (req.headers['x-correlation-id'] as string) || 'unknown';
    if (!oldRefreshToken || typeof oldRefreshToken !== 'string') {
      throw new ProblemException(401, 'Unauthorized', 'Missing or invalid refresh token in cookie', correlationId);
    }
    const ip = getClientIp(req);
    const userAgent = getClientUserAgent(req);

    const result = await this.authService.rotateTokens(oldRefreshToken, userAgent, ip);

    const cookieOpts = getRefreshTokenCookieOptions(
      this.envConfig.cookieSecure,
      this.envConfig.cookieDomain
    );
    res.cookie('refreshToken', result.refreshToken, cookieOpts);

    return {
      accessToken: result.accessToken,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: HttpRequest,
    @Res({ passthrough: true }) res: HttpResponse
  ) {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    const cookieOpts = getRefreshTokenCookieOptions(
      this.envConfig.cookieSecure,
      this.envConfig.cookieDomain
    );
    res.clearCookie('refreshToken', cookieOpts);
  }

  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  async listSessions(
    @Headers('authorization') authHeader?: string,
    @Headers('x-correlation-id') correlationId = 'unknown',
    @Query('limit') limit = '20',
    @Query('offset') offset = '0'
  ) {
    if (!authHeader) {
      throw new ProblemException(401, 'Unauthorized', 'Missing authorization header', correlationId);
    }
    const token = extractBearer(authHeader);
    let user;
    try {
      user = this.authService.verifyAccessToken(token);
    } catch {
      throw new ProblemException(401, 'Unauthorized', 'Invalid or expired access token', correlationId);
    }

    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const parsedOffset = Math.max(0, parseInt(offset, 10) || 0);

    const result = await this.authService.listUserSessions(
      user.sub,
      parsedLimit,
      parsedOffset
    );
    return {
      items: result.items,
      total: result.total,
      limit: parsedLimit,
      offset: parsedOffset,
    };
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @Param('id') sessionId: string,
    @Headers('authorization') authHeader?: string,
    @Headers('x-correlation-id') correlationId = 'unknown'
  ) {
    if (!authHeader) {
      throw new ProblemException(401, 'Unauthorized', 'Missing authorization header', correlationId);
    }
    const token = extractBearer(authHeader);
    let user;
    try {
      user = this.authService.verifyAccessToken(token);
    } catch {
      throw new ProblemException(401, 'Unauthorized', 'Invalid or expired access token', correlationId);
    }
    await this.authService.revokeSession(user.sub, sessionId);
  }

  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  async setupMfa(
    @Headers('authorization') authHeader?: string,
    @Body() body?: { mfaTicket?: string }
  ) {
    let userId: string;
    if (authHeader) {
      const user = this.authService.verifyAccessToken(extractBearer(authHeader));
      userId = user.sub;
    } else if (body?.mfaTicket) {
      const parts = body.mfaTicket.split(':');
      userId = parts[1] || parts[0];
    } else {
      throw new Error('Either Authorization header or mfaTicket is required');
    }

    return this.authService.setupMfaForUser(userId);
  }

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  async verifyMfa(
    @Body() body: { code: string; mfaTicket?: string },
    @Headers('authorization') authHeader?: string,
    @Res({ passthrough: true }) res?: HttpResponse
  ) {
    if (body.mfaTicket) {
      const result = await this.authService.verifyMfaChallenge(
        body.mfaTicket,
        body.code,
        'Browser',
        '127.0.0.1'
      );
      if (res) {
        const cookieOpts = getRefreshTokenCookieOptions(
          this.envConfig.cookieSecure,
          this.envConfig.cookieDomain
        );
        res.cookie('refreshToken', result.refreshToken, cookieOpts);
      }
      return {
        accessToken: result.accessToken,
      };
    } else if (authHeader) {
      const user = this.authService.verifyAccessToken(extractBearer(authHeader));
      await this.authService.confirmMfaSetup(user.sub, body.code);
      return {
        success: true,
      };
    } else {
      throw new Error('Either mfaTicket or Authorization header is required');
    }
  }
}
