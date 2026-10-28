import crypto from 'node:crypto';
import { Body, Controller, Get, Headers, HttpCode, HttpException, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import { AuthService } from '../application/auth.service.js';
import { PasswordAuthService, PasswordSignInResult, SignupInput } from '../application/password-auth.service.js';
import { getRefreshTokenCookieOptions } from '../config/cookie.config.js';
import { AuthMethod, IdentityEnvConfig, defaultAuthMethods } from '../config/env.js';
import { getClientIp, type HttpRequest, type HttpResponse } from './nest-auth.controller.js';

export const DEVICE_COOKIE = 'ob_device';
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const clientIp = getClientIp;

function userAgent(req?: HttpRequest): string {
  const ua = req?.headers?.['user-agent'];
  return (typeof ua === 'string' ? ua : Array.isArray(ua) ? ua[0] : '') || 'Unknown device';
}

/**
 * D-AUTH-EMAIL (VPS plan A5): email + password endpoints. Successful sign-ins set the same
 * refresh cookie as the phone flow; every response also keeps the httpOnly `ob_device`
 * cookie that identifies this browser for the new-device check (D4).
 */
@Controller('auth')
export class PasswordAuthController {
  constructor(
    private readonly passwords: PasswordAuthService,
    private readonly authService: AuthService,
    @Inject('IDENTITY_ENV_CONFIG') private readonly env: IdentityEnvConfig
  ) {}

  private methods(): AuthMethod[] {
    return this.env.authMethods ?? defaultAuthMethods(this.env.nodeEnv);
  }

  private requireEmailMethod(): void {
    if (!this.methods().includes('email')) {
      throw new HttpException({ title: 'Forbidden', detail: 'Email sign-in is turned off on this server.', code: 'method_disabled' }, 403);
    }
  }

  /** Reads the device cookie, creating it on first use. */
  private device(req: HttpRequest | undefined, res: HttpResponse | undefined, correlationId: string, deviceLabel?: string) {
    let deviceId = req?.cookies?.[DEVICE_COOKIE];
    if (typeof deviceId !== 'string' || !/^[A-Za-z0-9_-]{20,100}$/.test(deviceId)) {
      deviceId = crypto.randomBytes(24).toString('base64url');
    }
    res?.cookie(DEVICE_COOKIE, deviceId, {
      ...getRefreshTokenCookieOptions(this.env.cookieSecure, this.env.cookieDomain, this.env.cookiePath),
      maxAge: ONE_YEAR_MS,
    });
    return { deviceId, deviceLabel: (deviceLabel || userAgent(req)).slice(0, 200), ip: clientIp(req), correlationId };
  }

  private finish(result: PasswordSignInResult, res?: HttpResponse) {
    if (result.refreshToken && res) {
      res.cookie('refreshToken', result.refreshToken, getRefreshTokenCookieOptions(this.env.cookieSecure, this.env.cookieDomain, this.env.cookiePath));
    }
    return {
      status: result.status,
      accessToken: result.accessToken,
      mfaTicket: result.mfaTicket,
      ticket: result.ticket,
      maskedEmail: result.maskedEmail,
    };
  }

  @Get('methods')
  methodsList() {
    const methods = this.methods();
    return { methods, ...(methods.includes('google') && this.env.googleClientId ? { googleClientId: this.env.googleClientId } : {}) };
  }

  @Post('signup')
  @HttpCode(HttpStatus.ACCEPTED)
  async signup(@Body() body: SignupInput, @Req() req?: HttpRequest) {
    this.requireEmailMethod();
    return this.passwords.signup(body, clientIp(req));
  }

  @Post('signup/verify')
  @HttpCode(HttpStatus.OK)
  async verifySignup(
    @Body() body: { ticket: string; code: string; deviceLabel?: string },
    @Headers('x-correlation-id') correlationId = 'unknown',
    @Req() req?: HttpRequest,
    @Res({ passthrough: true }) res?: HttpResponse
  ) {
    this.requireEmailMethod();
    const ctx = this.device(req, res, correlationId, body?.deviceLabel);
    return this.finish(await this.passwords.verifySignup(body?.ticket, body?.code, ctx), res);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: { email: string; password: string; deviceLabel?: string },
    @Headers('x-correlation-id') correlationId = 'unknown',
    @Req() req?: HttpRequest,
    @Res({ passthrough: true }) res?: HttpResponse
  ) {
    this.requireEmailMethod();
    const ctx = this.device(req, res, correlationId, body?.deviceLabel);
    return this.finish(await this.passwords.login(body, ctx), res);
  }

  @Post('login/verify')
  @HttpCode(HttpStatus.OK)
  async verifyLogin(
    @Body() body: { ticket: string; code: string; deviceLabel?: string },
    @Headers('x-correlation-id') correlationId = 'unknown',
    @Req() req?: HttpRequest,
    @Res({ passthrough: true }) res?: HttpResponse
  ) {
    this.requireEmailMethod();
    const ctx = this.device(req, res, correlationId, body?.deviceLabel);
    return this.finish(await this.passwords.verifyLogin(body?.ticket, body?.code, ctx), res);
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgot(@Body() body: { email: string }, @Req() req?: HttpRequest) {
    this.requireEmailMethod();
    return this.passwords.forgotPassword(body?.email, clientIp(req));
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reset(@Body() body: { ticket: string; code: string; newPassword: string }, @Headers('x-correlation-id') correlationId = 'unknown') {
    this.requireEmailMethod();
    await this.passwords.resetPassword(body?.ticket, body?.code, body?.newPassword, correlationId);
  }

  @Post('password/change')
  @HttpCode(HttpStatus.NO_CONTENT)
  async change(
    @Body() body: { currentPassword: string; newPassword: string },
    @Headers('authorization') authHeader?: string,
    @Headers('x-correlation-id') correlationId = 'unknown'
  ) {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    let user: { sub: string; familyId?: string };
    try {
      user = this.authService.verifyAccessToken(token) as { sub: string; familyId?: string };
    } catch {
      throw new HttpException({ title: 'Unauthorized', detail: 'Sign in again to change your password.', code: 'unauthorized' }, 401);
    }
    await this.passwords.changePassword(user.sub, user.familyId, body?.currentPassword, body?.newPassword, correlationId);
  }

  @Post('code/resend')
  @HttpCode(HttpStatus.ACCEPTED)
  async resend(@Body() body: { ticket: string }, @Req() req?: HttpRequest) {
    return this.passwords.resendCode(body?.ticket, clientIp(req));
  }
}
