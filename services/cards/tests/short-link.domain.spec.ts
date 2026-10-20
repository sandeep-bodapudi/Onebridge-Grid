import { describe, it, expect } from 'vitest';
import {
  generateShortLinkCode,
  validateShortLinkCode,
  createShortLink,
  repointShortLink,
  updateShortLinkStatus,
  validateDestinationUrl,
  isOneBridgeDestination,
  hostsOf,
  ShortLinkProps,
} from '../src/domain/short-link.js';

describe('ShortLink Domain Model (F11)', () => {
  it('AC-1: generates an 8-character alphanumeric shortlink code', () => {
    const code = generateShortLinkCode();
    expect(code).toHaveLength(8);
    expect(validateShortLinkCode(code)).toBe(true);
    // Base62 characters [0-9a-zA-Z]
    expect(/^[0-9a-zA-Z]{8}$/.test(code)).toBe(true);
  });

  it('AC-1: enforces immutability of short link code when repointing', () => {
    const original: ShortLinkProps = createShortLink({
      id: '01JD2XSL00000000000000001',
      tenantId: '01JD2XORG00000000000000001',
      targetType: 'card',
      targetId: 'OB-7KQ2MX-E0001',
      destinationUrl: 'https://grid.onebridge.in/acme/sneha',
      source: 'default',
    });

    const originalCode = original.code;
    const repointed = repointShortLink(original, 'https://grid.onebridge.in/acme/sneha-v2', '01JD2XPER00000000000000001');

    // Code is strictly immutable
    expect(repointed.code).toBe(originalCode);
    expect(repointed.destinationUrl).toBe('https://grid.onebridge.in/acme/sneha-v2');
    expect(repointed.aggregateVersion).toBe(original.aggregateVersion + 1);
  });

  it('AC-3: supports status transitions (active, disabled, unactivated, pending_approval)', () => {
    const link = createShortLink({
      id: '01JD2XSL00000000000000002',
      tenantId: '01JD2XORG00000000000000001',
      targetType: 'card',
      targetId: 'OB-7KQ2MX-E0001',
      destinationUrl: 'https://grid.onebridge.in/acme/sneha',
    });

    expect(link.status).toBe('active');

    const disabled = updateShortLinkStatus(link, 'disabled', 'Lost badge');
    expect(disabled.status).toBe('disabled');
    expect(disabled.statusReason).toBe('Lost badge');
    expect(disabled.aggregateVersion).toBe(link.aggregateVersion + 1);

    const activated = updateShortLinkStatus(disabled, 'active');
    expect(activated.status).toBe('active');
  });

  describe('AC-7: Destination URL Safety & External Destination Checks', () => {
    it('allows valid internal OneBridge URLs and relative paths', () => {
      expect(isOneBridgeDestination('https://grid.onebridge.in/acme/sneha')).toBe(true);
      expect(isOneBridgeDestination('https://obg.in/acme/sneha')).toBe(true);
      expect(isOneBridgeDestination('/c/acme/sneha')).toBe(true);
      expect(isOneBridgeDestination('https://external-site.com')).toBe(false);

      const checkInternal = validateDestinationUrl('https://grid.onebridge.in/acme/sneha', {
        allowExternal: false,
        callerRole: 'employee',
      });
      expect(checkInternal.isValid).toBe(true);
    });

    it('rejects external destinations when caller is not Company Admin (AC-7)', () => {
      const checkEmployee = validateDestinationUrl('https://my-company-portfolio.com', {
        allowExternal: false,
        callerRole: 'employee',
      });
      expect(checkEmployee.isValid).toBe(false);
      expect(checkEmployee.reason).toMatch(/External destinations need Company Admin approval/i);
    });

    it('validates URL safety for external destinations approved by Admin', () => {
      const checkAdmin = validateDestinationUrl('https://my-company-portfolio.com', {
        allowExternal: true,
        callerRole: 'owner',
      });
      expect(checkAdmin.isValid).toBe(true);
    });

    it('rejects private IPs, localhost, and dangerous schemes (SSRF prevention)', () => {
      const dangerousUrls = [
        'http://127.0.0.1:8080/admin',
        'http://localhost:3000',
        'http://10.0.0.1/secret',
        'http://192.168.1.1',
        'http://169.254.169.254/latest/meta-data',
        'javascript:alert(1)',
        'data:text/html,payload',
        'file:///etc/passwd',
      ];

      for (const url of dangerousUrls) {
        const result = validateDestinationUrl(url, { allowExternal: true, callerRole: 'admin' });
        expect(result.isValid).toBe(false);
        expect(result.reason).toMatch(/unsafe or prohibited/i);
      }
    });
  });

  describe('Configurable short-link base and trusted hosts (demo / staging hosts)', () => {
    const base = {
      id: '01JD2XSL00000000000000009',
      tenantId: '01JD2XORG00000000000000001',
      targetType: 'card' as const,
      targetId: 'OB-7KQ2MX-E0001',
      source: 'default',
    };

    it('defaults the short URL to https://obg.in/<code>', () => {
      const link = createShortLink({ ...base, destinationUrl: 'https://grid.onebridge.in/c/acme/sneha' });
      expect(link.shortUrl).toBe(`https://obg.in/${link.code}`);
    });

    it('uses a configured base (trailing slash tolerated)', () => {
      const link = createShortLink({
        ...base,
        destinationUrl: 'https://demo-public.example.com/c/acme/sneha',
        shortLinkBaseUrl: 'https://demo-public.example.com/r/',
        trustedHosts: ['demo-public.example.com'],
      });
      expect(link.shortUrl).toBe(`https://demo-public.example.com/r/${link.code}`);
    });

    it('treats a trusted deployment host as a OneBridge page, so the default link is active, not pending approval', () => {
      const link = createShortLink({
        ...base,
        destinationUrl: 'https://demo-public.example.com/c/acme/sneha',
        trustedHosts: ['demo-public.example.com'],
      });
      expect(link.isExternal).toBe(false);
      expect(link.status).toBe('active');
    });

    it('without the trusted host, the same destination is external and needs approval', () => {
      const link = createShortLink({ ...base, destinationUrl: 'https://demo-public.example.com/c/acme/sneha' });
      expect(link.isExternal).toBe(true);
      expect(link.status).toBe('pending_approval');
    });

    it('trusted hosts match exactly, not by suffix', () => {
      expect(isOneBridgeDestination('https://evil-demo-public.example.com/x', ['demo-public.example.com'])).toBe(false);
      expect(isOneBridgeDestination('https://demo-public.example.com/x', ['demo-public.example.com'])).toBe(true);
    });

    it('validateDestinationUrl lets a non-admin point at a trusted host', () => {
      const res = validateDestinationUrl('https://demo-public.example.com/c/acme/sneha', {
        callerRole: 'employee',
        trustedHosts: ['demo-public.example.com'],
      });
      expect(res.isValid).toBe(true);
    });

    it('hostsOf extracts hostnames and ignores malformed values', () => {
      expect(hostsOf('https://A.example.com/r', 'not a url', undefined, 'http://localhost:3001')).toEqual([
        'a.example.com',
        'localhost',
      ]);
    });
  });
});
