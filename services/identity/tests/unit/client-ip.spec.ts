import { describe, it, expect } from 'vitest';
import { getClientIp } from '../../src/presentation/nest-auth.controller';

describe('D-VPS-DEPLOY: the visitor address behind the router', () => {
  it('uses the first X-Forwarded-For entry, not the router socket (127.0.0.1)', () => {
    expect(getClientIp({ ip: '127.0.0.1', headers: { 'x-forwarded-for': '203.0.113.7, 172.18.0.5' } })).toBe('203.0.113.7');
    expect(getClientIp({ ip: '127.0.0.1', headers: { 'x-forwarded-for': ['198.51.100.2'] } })).toBe('198.51.100.2');
  });

  it('falls back to the socket address, then loopback', () => {
    expect(getClientIp({ ip: '10.0.0.9', headers: {} })).toBe('10.0.0.9');
    expect(getClientIp(undefined)).toBe('127.0.0.1');
  });
});
