import crypto from 'node:crypto';
import { InMemorySessionRepository } from '../infrastructure/repositories/in-memory-session.repository.js';
import { Session, SessionFamily } from '../domain/session.js';

export interface DecodedToken {
  sub: string;
  familyId: string;
  sessionId: string;
  iat: number;
  exp: number;
  [key: string]: any;
}

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge: number;
}

export class TokenService {
  constructor(
    private sessionRepo: InMemorySessionRepository,
    private jwtSecret: string
  ) {}

  private base64UrlEncode(str: string): string {
    return Buffer.from(str)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  private base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf8');
  }

  private signJwt(payload: any, expiresInSeconds: number): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const fullPayload = {
      ...payload,
      iat: now,
      exp: now + expiresInSeconds,
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(fullPayload));
    const signature = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  verifyJwt(token: string): DecodedToken {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    const [headerB64, payloadB64, sigB64] = parts;
    const expectedSig = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (sigB64 !== expectedSig) {
      throw new Error('Invalid JWT signature');
    }

    const payload: DecodedToken = JSON.parse(this.base64UrlDecode(payloadB64));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('JWT expired');
    }

    return payload;
  }

  verifyAccessToken(token: string): DecodedToken {
    return this.verifyJwt(token);
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  getCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    };
  }

  async createSessionFamily(
    userId: string,
    deviceLabel: string,
    ipAddress: string
  ): Promise<{ accessToken: string; refreshToken: string; session: Session }> {
    const familyId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();

    // 15 minutes access token
    const accessToken = this.signJwt(
      { sub: userId, familyId, sessionId, type: 'access' },
      15 * 60
    );

    // Refresh token
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenPayload = this.signJwt(
      { sub: userId, familyId, sessionId, tokenValue: rawRefreshToken, type: 'refresh' },
      30 * 24 * 60 * 60
    );
    const refreshTokenHash = this.hashToken(refreshTokenPayload);

    const family: SessionFamily = {
      familyId,
      userId,
      isRevoked: false,
      currentRefreshTokenHash: refreshTokenHash,
      usedRefreshTokenHashes: new Set<string>(),
      createdAt: now,
      updatedAt: now,
    };
    await this.sessionRepo.saveFamily(family);

    const session: Session = {
      sessionId,
      familyId,
      userId,
      deviceLabel,
      ipAddress,
      createdAt: now,
      lastActiveAt: now,
      isRevoked: false,
    };
    await this.sessionRepo.saveSession(session);

    return { accessToken, refreshToken: refreshTokenPayload, session };
  }

  async rotateRefreshToken(
    oldRefreshToken: string,
    deviceLabelOrIp: string = '127.0.0.1',
    ipAddress: string = '127.0.0.1'
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const effectiveIp = ipAddress || deviceLabelOrIp || '127.0.0.1';
    const decoded = this.verifyJwt(oldRefreshToken);
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    const family = await this.sessionRepo.findFamilyById(decoded.familyId);
    if (!family || family.isRevoked) {
      throw new Error('Session family is revoked');
    }

    const oldHash = this.hashToken(oldRefreshToken);

    // Reuse detection: If token was already used, someone stole it! Revoke entire family!
    if (family.usedRefreshTokenHashes.has(oldHash)) {
      await this.sessionRepo.revokeFamily(family.familyId);
      throw new Error('Refresh token reuse detected: entire session family revoked');
    }

    // Must match the current active refresh token
    if (family.currentRefreshTokenHash !== oldHash) {
      await this.sessionRepo.revokeFamily(family.familyId);
      throw new Error('Invalid refresh token');
    }

    // Mark old token as used
    family.usedRefreshTokenHashes.add(oldHash);

    // Generate new rotated token pair
    const newRawRefreshToken = crypto.randomBytes(32).toString('hex');
    const newRefreshToken = this.signJwt(
      { sub: family.userId, familyId: family.familyId, sessionId: decoded.sessionId, tokenValue: newRawRefreshToken, type: 'refresh' },
      30 * 24 * 60 * 60
    );
    family.currentRefreshTokenHash = this.hashToken(newRefreshToken);
    family.updatedAt = new Date().toISOString();
    await this.sessionRepo.saveFamily(family);

    // Update session active time
    const session = await this.sessionRepo.findSessionById(decoded.sessionId);
    if (session) {
      session.lastActiveAt = new Date().toISOString();
      session.ipAddress = effectiveIp;
      await this.sessionRepo.saveSession(session);
    }

    const accessToken = this.signJwt(
      { sub: family.userId, familyId: family.familyId, sessionId: decoded.sessionId, type: 'access' },
      15 * 60
    );

    return { accessToken, refreshToken: newRefreshToken };
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      const decoded = this.verifyJwt(refreshToken);
      if (decoded && decoded.familyId) {
        await this.sessionRepo.revokeFamily(decoded.familyId);
      }
    } catch {
      // Ignore invalid token on revoke
    }
  }

  async revokeSession(sessionId: string): Promise<void> {
    const session = await this.sessionRepo.findSessionById(sessionId);
    if (session) {
      await this.sessionRepo.revokeFamily(session.familyId);
    }
  }
}
