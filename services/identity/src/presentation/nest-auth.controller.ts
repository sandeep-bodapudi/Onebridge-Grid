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
import { AuthService } from '../application/auth.service.js';
import { MfaService } from '../application/mfa.service.js';
import { getRefreshTokenCookieOptions } from '../config/cookie.config.js';
import { IdentityEnvConfig } from '../config/env.js';

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
    @Headers('x-correlation-id') correlationId?: string,
    @Req() req?: HttpRequest
  ) {
    const ip = (req?.ip || (req?.headers['x-forwarded-for'] as string) || '127.0.0.1').split(',')[0].trim();
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
    const ip = (req?.ip || (req?.headers['x-forwarded-for'] as string) || '127.0.0.1').split(',')[0].trim();
    const userAgent = req?.headers['user-agent'] || 'Unknown';
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
    const ip = (req?.ip || '127.0.0.1').split(',')[0].trim();
    const userAgent = req?.headers['user-agent'] || 'Unknown';
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
    const ip = (req.ip || '127.0.0.1').split(',')[0].trim();
    const userAgent = req.headers['user-agent'] || 'Unknown';

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
    @Headers('authorization') authHeader: string,
    @Query('limit') limit = '20',
    @Query('offset') offset = '0'
  ) {
    const user = this.authService.verifyAccessToken(authHeader);
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
    @Headers('authorization') authHeader: string
  ) {
    const user = this.authService.verifyAccessToken(authHeader);
    await this.authService.revokeSession(sessionId, user.sub);
  }

  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  async setupMfa(
    @Headers('authorization') authHeader?: string,
    @Body() body?: { mfaTicket?: string }
  ) {
    let userId: string;
    if (authHeader) {
      const user = this.authService.verifyAccessToken(authHeader);
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
      const user = this.authService.verifyAccessToken(authHeader);
      await this.authService.confirmMfaSetup(user.sub, body.code);
      return {
        success: true,
      };
    } else {
      throw new Error('Either mfaTicket or Authorization header is required');
    }
  }
}
