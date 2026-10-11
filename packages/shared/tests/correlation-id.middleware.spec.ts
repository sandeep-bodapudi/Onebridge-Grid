import { describe, it, expect } from 'vitest';
import { correlationIdMiddleware } from '../src/correlation';

describe('AC-9: Correlation ID', () => {
  it('should create X-Correlation-ID if missing', () => {
    const req: any = {};
    correlationIdMiddleware(req, {}, () => {});
    expect(req.headers['x-correlation-id']).toBeDefined();
  });
});
