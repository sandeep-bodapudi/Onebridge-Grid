import { describe, it, expect } from 'vitest';
import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ServiceKeyGuard } from '../../src/presentation/guards/service-key.guard';

function createMockContext(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('ServiceKeyGuard & /internal/* Protection (Condition 5)', () => {
  const EXPECTED_KEY = 'super-secret-service-internal-key-12345';
  const guard = new ServiceKeyGuard(EXPECTED_KEY);

  it('should reject requests missing x-service-key with 401 Unauthorized', () => {
    const ctx = createMockContext({});
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should reject requests with invalid x-service-key with 401 Unauthorized', () => {
    const ctx = createMockContext({ 'x-service-key': 'wrong-key' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should reject requests with user Bearer token with 403 Forbidden', () => {
    const ctx = createMockContext({
      authorization: 'Bearer user-jwt-token-attempting-internal-access',
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should allow requests with valid x-service-key', () => {
    const ctx = createMockContext({
      'x-service-key': EXPECTED_KEY,
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
