import { describe, it, expect, beforeEach } from 'vitest';
import { TokenService } from '../../src/application/token.service';
import { InMemorySessionRepository } from '../../src/infrastructure/repositories/in-memory-session.repository';

describe('Token Service (AC-5, AC-6)', () => {
  let sessionRepo: InMemorySessionRepository;
  let tokenService: TokenService;

  beforeEach(() => {
    sessionRepo = new InMemorySessionRepository();
    tokenService = new TokenService(sessionRepo, 'test-secret-key-32-chars-long-12345');
  });

  describe('AC-6: 15-minute access token & rotating refresh token', () => {
    it('should issue access token with 15 minutes expiry and a refresh token', async () => {
      const session = await tokenService.createSessionFamily('user-123', 'Chrome on Mac', '127.0.0.1');
      expect(session.accessToken).toBeDefined();
      expect(session.refreshToken).toBeDefined();

      const decodedAccess = tokenService.verifyAccessToken(session.accessToken);
      expect(decodedAccess.sub).toBe('user-123');
      // ~15 min (900 seconds)
      const diffSec = decodedAccess.exp - decodedAccess.iat;
      expect(diffSec).toBe(900);
    });

    it('should rotate refresh token upon each refresh call', async () => {
      const initial = await tokenService.createSessionFamily('user-123', 'Chrome on Mac', '127.0.0.1');
      const rotated = await tokenService.rotateRefreshToken(initial.refreshToken, '127.0.0.1');

      expect(rotated.accessToken).toBeDefined();
      expect(rotated.refreshToken).toBeDefined();
      expect(rotated.refreshToken).not.toBe(initial.refreshToken);
    });

    it('should revoke entire session family if an already-used refresh token is reused', async () => {
      const initial = await tokenService.createSessionFamily('user-123', 'Chrome on Mac', '127.0.0.1');
      const rotated = await tokenService.rotateRefreshToken(initial.refreshToken, '127.0.0.1');

      // Attempting to reuse initial.refreshToken must revoke the entire session family!
      await expect(tokenService.rotateRefreshToken(initial.refreshToken, '127.0.0.1'))
        .rejects.toThrow('Refresh token reuse detected: entire session family revoked');

      // Now even the new rotated token should no longer work because family is revoked!
      await expect(tokenService.rotateRefreshToken(rotated.refreshToken, '127.0.0.1'))
        .rejects.toThrow('Session family is revoked');
    });
  });

  describe('AC-5: Refresh cookie format', () => {
    it('should generate cookie options with SameSite=Lax, HttpOnly, and Secure', () => {
      const cookieOpts = tokenService.getCookieOptions();
      expect(cookieOpts.httpOnly).toBe(true);
      expect(cookieOpts.secure).toBe(true);
      expect(cookieOpts.sameSite).toBe('lax');
    });
  });
});
