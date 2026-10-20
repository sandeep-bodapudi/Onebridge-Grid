import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryRateLimiter } from '../src/rate-limiter.js';

describe('AC-6: Rate limiting per IP and per card', () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter();
  });

  it('allows requests within window and limit', () => {
    const result1 = limiter.consume('ip:192.168.1.1', { limit: 3, windowMs: 1000 });
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(2);

    const result2 = limiter.consume('ip:192.168.1.1', { limit: 3, windowMs: 1000 });
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(1);

    const result3 = limiter.consume('ip:192.168.1.1', { limit: 3, windowMs: 1000 });
    expect(result3.allowed).toBe(true);
    expect(result3.remaining).toBe(0);
  });

  it('blocks requests exceeding limit within window', () => {
    limiter.consume('card:card-123', { limit: 2, windowMs: 60000 });
    limiter.consume('card:card-123', { limit: 2, windowMs: 60000 });

    const blocked = limiter.consume('card:card-123', { limit: 2, windowMs: 60000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('resets count after window expires', () => {
    vi.useFakeTimers();
    try {
      limiter.consume('ip:10.0.0.1', { limit: 1, windowMs: 1000 });
      expect(limiter.consume('ip:10.0.0.1', { limit: 1, windowMs: 1000 }).allowed).toBe(false);

      vi.advanceTimersByTime(1100);

      const afterExpiry = limiter.consume('ip:10.0.0.1', { limit: 1, windowMs: 1000 });
      expect(afterExpiry.allowed).toBe(true);
      expect(afterExpiry.remaining).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('tracks distinct keys independently', () => {
    limiter.consume('ip:1.1.1.1', { limit: 1, windowMs: 1000 });
    const otherIp = limiter.consume('ip:2.2.2.2', { limit: 1, windowMs: 1000 });
    expect(otherIp.allowed).toBe(true);
  });
});
