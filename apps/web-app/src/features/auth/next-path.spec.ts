import { describe, it, expect } from 'vitest';
import { safeNextPath, withNext } from './next-path';

describe('D-AUTH-EMAIL: where sign-in goes next', () => {
  it('allows paths on this site only', () => {
    expect(safeNextPath('/invite/abc123')).toBe('/invite/abc123');
    expect(safeNextPath('/dashboard?tab=cards')).toBe('/dashboard?tab=cards');
  });

  it('falls back for other sites, protocol-relative and odd values', () => {
    for (const bad of ['https://evil.example', '//evil.example/x', '/\\evil.example', 'javascript:alert(1)', 'invite/abc', '/x\r\nSet-Cookie: a=b', '', null, undefined]) {
      expect(safeNextPath(bad)).toBe('/dashboard');
    }
  });

  it('adds next to sign-in links, encoded', () => {
    expect(withNext('/login', '/invite/a b')).toBe('/login?next=%2Finvite%2Fa%20b');
    expect(withNext('/login', null)).toBe('/login');
  });
});
