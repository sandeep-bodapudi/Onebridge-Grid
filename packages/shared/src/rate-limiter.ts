export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs?: number;
}

interface WindowBucket {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  consume(key: string, options: RateLimitOptions): RateLimitResult;
  /** Reports whether `key` is over its limit, without counting this call. */
  peek(key: string, options: RateLimitOptions): RateLimitResult;
  reset(key: string): void;
}

export class InMemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, WindowBucket>();

  consume(key: string, options: RateLimitOptions): RateLimitResult {
    const now = Date.now();
    // Keys are per email or per network, so drop finished windows before the map grows without end.
    if (this.buckets.size >= 10_000) {
      for (const [k, bucket] of this.buckets) if (now >= bucket.resetAt) this.buckets.delete(k);
    }
    const existing = this.buckets.get(key);

    if (!existing || now >= existing.resetAt) {
      const resetAt = now + options.windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        remaining: Math.max(0, options.limit - 1),
        resetAt,
      };
    }

    if (existing.count >= options.limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: existing.resetAt,
        retryAfterMs: Math.max(0, existing.resetAt - now),
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, options.limit - existing.count),
      resetAt: existing.resetAt,
    };
  }

  peek(key: string, options: RateLimitOptions): RateLimitResult {
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (!existing || now >= existing.resetAt) return { allowed: true, remaining: options.limit, resetAt: now + options.windowMs };
    const allowed = existing.count < options.limit;
    return {
      allowed,
      remaining: Math.max(0, options.limit - existing.count),
      resetAt: existing.resetAt,
      ...(allowed ? {} : { retryAfterMs: Math.max(0, existing.resetAt - now) }),
    };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  clear(): void {
    this.buckets.clear();
  }
}
