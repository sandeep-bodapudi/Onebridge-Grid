export interface CacheStore {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttlSeconds: number): Promise<void>;
}

export class IdempotencyInterceptor {
  constructor(private cache: CacheStore) {}

  async handle(request: any) {
    const key = request.headers['idempotency-key'];
    if (!key) return request.body;

    const cached = await this.cache.get(key);
    if (cached) {
      if (JSON.stringify(cached.requestBody) !== JSON.stringify(request.body)) {
        throw new Error('422 Unprocessable Entity: Mismatching body');
      }
      return cached.response;
    }

    const response = { status: 'success', data: request.body };
    await this.cache.set(key, { requestBody: request.body, response }, 86400); // 24 hours
    return response;
  }
}
