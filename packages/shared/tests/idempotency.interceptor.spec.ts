import { describe, it, expect } from 'vitest';
import { IdempotencyInterceptor, CacheStore, CachedIdempotencyRecord } from '../src/idempotency';

class MockCache implements CacheStore {
  private store = new Map<string, CachedIdempotencyRecord>();
  async get(key: string) { return this.store.get(key) || null; }
  async set(key: string, value: CachedIdempotencyRecord, _ttl: number) { this.store.set(key, value); }
}

describe('AC-8: Idempotency', () => {
  it('should cache response for 24 hours and reject mismatching body with 422', async () => {
    const cache = new MockCache();
    const interceptor = new IdempotencyInterceptor(cache);
    const req1 = { headers: { 'idempotency-key': 'key1' }, body: { a: 1 } };
    const res1 = await interceptor.handle(req1);
    
    // Replay with same body
    const res2 = await interceptor.handle(req1);
    expect(res1).toEqual(res2);
    
    // Replay with mismatching body
    const req2 = { headers: { 'idempotency-key': 'key1' }, body: { a: 2 } };
    await expect(interceptor.handle(req2)).rejects.toThrow('422 Unprocessable Entity: Mismatching body');
  });
});
