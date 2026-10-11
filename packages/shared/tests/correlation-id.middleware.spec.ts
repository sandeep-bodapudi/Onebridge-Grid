import { describe, it, expect } from 'vitest';
import { correlationIdMiddleware, CorrelationRequest } from '../src/correlation';

describe('AC-9: Correlation ID', () => {
  it('should create X-Correlation-ID if missing', () => {
    const req: CorrelationRequest = {};
    correlationIdMiddleware(req, {}, () => {});
    expect(req.headers?.['x-correlation-id']).toBeDefined();
  });
});
