import { AuthService } from '../application/auth.service.js';
import { Session } from '../domain/session.js';
import { CacheStore } from '@onebridge/shared';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  correlationId: string;
}

export class ProblemException extends Error {
  public problem: ProblemDetails;
  constructor(status: number, title: string, detail: string, correlationId: string) {
    super(detail || title);
    this.problem = {
      type: 'https://tools.ietf.org/html/rfc7807',
      title,
      status,
      detail,
      correlationId,
    };
  }
}

export class InMemoryCacheStore implements CacheStore {
  private cache = new Map<string, { value: any; expiresAt: number }>();
  async get(key: string) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }
  async set(key: string, value: any, ttlSeconds: number) {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

export class AuthController {
  private cacheStore: CacheStore;

  constructor(
    private authService: AuthService,
    cacheStore?: CacheStore
  ) {
    this.cacheStore = cacheStore || new InMemoryCacheStore();
  }

  private async handleIdempotency<T>(
    idempotencyKey: string | undefined,
    requestBody: any,
    correlationId: string,
    action: () => Promise<T>
  ): Promise<T> {
    if (!idempotencyKey) {
      return action();
    }

    const cached = await this.cacheStore.get(idempotencyKey);
    if (cached) {
      if (JSON.stringify(cached.requestBody) !== JSON.stringify(requestBody)) {
        throw new ProblemException(
          422,
          'Unprocessable Entity',
          'Mismatching body for idempotency key',
          correlationId
        );
      }
      return cached.response as T;
    }

    const response = await action();
    await this.cacheStore.set(idempotencyKey, { requestBody, response }, 86400);
    return response;
  }

  private extractUserIdFromAuth(authorization?: string, correlationId = 'unknown'): string {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new ProblemException(
        401,
        'Unauthorized',
        'Missing or invalid Bearer token',
        correlationId
      );
    }
    const token = authorization.slice(7).trim();
    try {
      const decoded = this.authService.tokenService.verifyAccessToken(token);
      return decoded.sub;
    } catch (err: any) {
      throw new ProblemException(
        401,
        'Unauthorized',
        err.message || 'Token verification failed',
        correlationId
      );
    }
  }

  async requestOtp(
    body: { phone: string; email?: string },
    ctx: { ip: string; correlationId: string; idempotencyKey?: string }
  ) {
    try {
      return await this.handleIdempotency(
        ctx.idempotencyKey,
        body,
        ctx.correlationId,
        async () => {
          const result = await this.authService.otpService.requestOtp(
            body.phone,
            ctx.ip,
            body.email
          );
          return {
            status: 200,
            body: result,
          };
        }
      );
    } catch (err: any) {
      if (err instanceof ProblemException) throw err;
      const status =
        err.message.includes('Rate limit') || err.message.includes('locked') ? 429 : 400;
      throw new ProblemException(status, 'OTP Request Failed', err.message, ctx.correlationId);
    }
  }

  async verifyOtp(
    body: { phone: string; code: string; deviceLabel?: string },
    ctx: { ip: string; correlationId: string; idempotencyKey?: string }
  ) {
    try {
      return await this.handleIdempotency(
        ctx.idempotencyKey,
        body,
        ctx.correlationId,
        async () => {
          const result = await this.authService.verifyOtpAndLogin(
            body.phone,
            body.code,
            body.deviceLabel || 'Browser',
            ctx.ip,
            ctx.correlationId
          );

          const headers: Record<string, string> = {};
          if (result.refreshToken) {
            headers['Set-Cookie'] = `refreshToken=${result.refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`;
          }

          return {
            status: 200,
            headers,
            body: {
              status: result.status,
              accessToken: result.accessToken,
              mfaTicket: result.mfaTicket,
            },
          };
        }
      );
    } catch (err: any) {
      if (err instanceof ProblemException) throw err;
      const status = err.message.includes('locked') ? 423 : 400;
      throw new ProblemException(status, 'OTP Verification Failed', err.message, ctx.correlationId);
    }
  }

  async handleOAuth(
    provider: 'google' | 'microsoft',
    body: {
      idToken: string;
      deviceLabel?: string;
      mockProfile?: {
        sub: string;
        email?: string;
        emailVerified?: boolean;
        phone?: string;
        phoneVerified?: boolean;
        name?: string;
      };
    },
    ctx: { ip: string; correlationId: string }
  ) {
    try {
      const profile = body.mockProfile || {
        sub: 'mock-oauth-sub',
        email: 'user@example.com',
        emailVerified: true,
        name: 'OAuth User',
      };

      const result = await this.authService.handleOAuthLogin(
        provider,
        profile,
        body.deviceLabel || 'Browser',
        ctx.ip,
        ctx.correlationId
      );

      return {
        status: 200,
        headers: {
          'Set-Cookie': `refreshToken=${result.refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
        },
        body: {
          status: 'authenticated',
          accessToken: result.accessToken,
        },
      };
    } catch (err: any) {
      throw new ProblemException(400, 'OAuth Login Failed', err.message, ctx.correlationId);
    }
  }

  async refresh(
    refreshToken: string,
    ctx: { ip: string; correlationId: string; idempotencyKey?: string }
  ) {
    try {
      return await this.handleIdempotency(
        ctx.idempotencyKey,
        { refreshToken },
        ctx.correlationId,
        async () => {
          const rotated = await this.authService.tokenService.rotateRefreshToken(
            refreshToken,
            ctx.ip
          );
          return {
            status: 200,
            headers: {
              'Set-Cookie': `refreshToken=${rotated.refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
            },
            body: {
              accessToken: rotated.accessToken,
            },
          };
        }
      );
    } catch (err: any) {
      if (err instanceof ProblemException) throw err;
      throw new ProblemException(401, 'Token Refresh Failed', err.message, ctx.correlationId);
    }
  }

  async logout(
    sessionId: string,
    ctx: { authorization?: string; correlationId: string }
  ) {
    try {
      const userId = this.extractUserIdFromAuth(ctx.authorization, ctx.correlationId);
      await this.authService.revokeUserSession(userId, sessionId);
    } catch {
      // Best effort logout
    }
    return {
      status: 204,
      headers: {
        'Set-Cookie': 'refreshToken=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
      },
      body: null,
    };
  }

  async listSessions(
    query: { limit?: number; offset?: number } = {},
    ctx: { authorization?: string; correlationId: string }
  ) {
    const userId = this.extractUserIdFromAuth(ctx.authorization, ctx.correlationId);
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = query.offset ?? 0;
    const result = await this.authService.listUserSessions(userId, limit, offset);

    return {
      status: 200,
      body: {
        items: result.items.map((s: Session) => ({
          id: s.sessionId,
          deviceLabel: s.deviceLabel,
          ipAddress: s.ipAddress,
          createdAt: s.createdAt,
          lastActiveAt: s.lastActiveAt,
          isCurrent: false,
        })),
        total: result.total,
        limit,
        offset,
      },
    };
  }

  async revokeSession(
    sessionId: string,
    ctx: { authorization?: string; correlationId: string }
  ) {
    const userId = this.extractUserIdFromAuth(ctx.authorization, ctx.correlationId);
    try {
      await this.authService.revokeUserSession(userId, sessionId);
      return { status: 204, body: null };
    } catch (err: any) {
      throw new ProblemException(403, 'Session Revocation Failed', err.message, ctx.correlationId);
    }
  }

  async setupMfa(userId: string, ctx: { correlationId: string }) {
    try {
      const setup = await this.authService.setupMfaForUser(userId);
      return { status: 200, body: setup };
    } catch (err: any) {
      throw new ProblemException(400, 'MFA Setup Failed', err.message, ctx.correlationId);
    }
  }

  async verifyMfa(
    body: { mfaTicket?: string; userId?: string; code: string; deviceLabel?: string },
    ctx: { ip: string; correlationId: string }
  ) {
    try {
      if (body.mfaTicket) {
        const result = await this.authService.verifyMfaChallenge(
          body.mfaTicket,
          body.code,
          body.deviceLabel || 'Browser',
          ctx.ip
        );
        return {
          status: 200,
          headers: {
            'Set-Cookie': `refreshToken=${result.refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
          },
          body: { accessToken: result.accessToken },
        };
      } else if (body.userId) {
        await this.authService.confirmMfaSetup(body.userId, body.code);
        return { status: 200, body: { success: true } };
      }
      throw new Error('Either mfaTicket or userId must be provided');
    } catch (err: any) {
      throw new ProblemException(400, 'MFA Verification Failed', err.message, ctx.correlationId);
    }
  }
}
