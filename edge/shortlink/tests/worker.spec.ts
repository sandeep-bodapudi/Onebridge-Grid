import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleShortLinkRequest, EdgeWorkerEnv, ShortLinkKvEntry } from '../src/worker.js';

describe('Edge Shortlink Worker (F11)', () => {
  let env: EdgeWorkerEnv;
  let kvStore: Map<string, string>;

  beforeEach(() => {
    kvStore = new Map<string, string>();
    env = {
      SHORTLINK_KV: {
        get: async (key: string) => kvStore.get(key) || null,
        put: async (key: string, value: string) => {
          kvStore.set(key, value);
        },
      },
      ANALYTICS_ENDPOINT: 'https://api.onebridge.in/analytics/events',
      ORIGIN_BASE_URL: 'https://api.onebridge.in',
    };
  });

  it('AC-2: resolves active short link in <100ms with 302 redirect', async () => {
    const entry: ShortLinkKvEntry = {
      code: 'x8Fk2LpQ',
      destinationUrl: 'https://grid.onebridge.in/acme-steels/sneha-r',
      status: 'active',
      targetType: 'card',
      targetId: 'OB-7KQ2MX-E0001',
      tenantId: '01JD2XORG00000000000000001',
      source: 'Expo 2026 standee',
      cachedAt: Date.now(),
    };
    kvStore.set('link:x8Fk2LpQ', JSON.stringify(entry));

    const req = new Request('https://obg.in/r/x8Fk2LpQ', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    const start = performance.now();
    const res = await handleShortLinkRequest(req, env);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://grid.onebridge.in/acme-steels/sneha-r');
  });

  it('AC-2: resolves from cache even if origin server is down', async () => {
    const entry: ShortLinkKvEntry = {
      code: 'x8Fk2LpQ',
      destinationUrl: 'https://grid.onebridge.in/acme-steels/sneha-r',
      status: 'active',
      targetType: 'card',
      targetId: 'OB-7KQ2MX-E0001',
      tenantId: '01JD2XORG00000000000000001',
      cachedAt: Date.now(),
    };
    kvStore.set('link:x8Fk2LpQ', JSON.stringify(entry));

    // Origin fetch fails completely
    const globalFetch = vi.fn().mockRejectedValue(new Error('Origin Connection Refused'));
    vi.stubGlobal('fetch', globalFetch);

    const req = new Request('https://obg.in/r/x8Fk2LpQ');
    const res = await handleShortLinkRequest(req, env);

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://grid.onebridge.in/acme-steels/sneha-r');

    vi.unstubAllGlobals();
  });

  it('AC-3: disabled or unactivated chips resolve to neutral page with NO personal data', async () => {
    const disabledEntry: ShortLinkKvEntry = {
      code: 'disab123',
      destinationUrl: 'https://grid.onebridge.in/acme-steels/sneha-r',
      status: 'disabled',
      targetType: 'card',
      targetId: 'OB-7KQ2MX-E0001',
      tenantId: '01JD2XORG00000000000000001',
      cachedAt: Date.now(),
    };
    kvStore.set('link:disab123', JSON.stringify(disabledEntry));

    const req = new Request('https://obg.in/r/disab123');
    const res = await handleShortLinkRequest(req, env);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    const body = await res.text();

    // Neutral message
    expect(body).toMatch(/card or link is currently inactive/i);
    // Strict prohibition: NO personal data in HTML
    expect(body).not.toContain('sneha-r');
    expect(body).not.toContain('acme-steels');
    expect(body).not.toContain('OB-7KQ2MX-E0001');
    expect(body).not.toContain('01JD2XORG');
  });

  it('AC-8: dispatches analytics event asynchronously without delaying or blocking redirect', async () => {
    const entry: ShortLinkKvEntry = {
      code: 'x8Fk2LpQ',
      destinationUrl: 'https://grid.onebridge.in/acme-steels/sneha-r',
      status: 'active',
      targetType: 'card',
      targetId: 'OB-7KQ2MX-E0001',
      tenantId: '01JD2XORG00000000000000001',
      source: 'Expo 2026 standee',
      cachedAt: Date.now(),
    };
    kvStore.set('link:x8Fk2LpQ', JSON.stringify(entry));

    let analyticsCalled = false;
    let analyticsPayload: Record<string, unknown> | null = null;

    // Analytics endpoint takes a long time or fails
    const globalFetch = vi.fn().mockImplementation(async (url: string, opts: RequestInit) => {
      if (url.includes('/analytics/events')) {
        analyticsCalled = true;
        analyticsPayload = JSON.parse(opts.body as string);
        return new Response(JSON.stringify({ status: 'queued' }), { status: 202 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', globalFetch);

    const ctx = {
      waitUntil: vi.fn((promise: Promise<unknown>) => promise),
    };

    const req = new Request('https://obg.in/r/x8Fk2LpQ', {
      headers: {
        'User-Agent': 'MobileSafari/604.1',
        'Referer': 'https://linkedin.com',
      },
    });

    const res = await handleShortLinkRequest(req, env, ctx);
    // Redirect must return immediately
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://grid.onebridge.in/acme-steels/sneha-r');

    // Wait until background async promise executes
    await Promise.resolve();
    expect(analyticsCalled).toBe(true);
    expect(analyticsPayload[0].eventType).toBe('qr_scanned');
    expect(analyticsPayload[0].properties.source).toBe('Expo 2026 standee');
    expect(analyticsPayload[0].properties.code).toBe('x8Fk2LpQ');
    expect(analyticsPayload[0].properties.deviceType).toBe('mobile');
    expect(analyticsPayload[0].properties.userAgent).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it('AC-8: redirect succeeds even when analytics endpoint throws an error', async () => {
    const entry: ShortLinkKvEntry = {
      code: 'x8Fk2LpQ',
      destinationUrl: 'https://grid.onebridge.in/acme-steels/sneha-r',
      status: 'active',
      targetType: 'card',
      targetId: 'OB-7KQ2MX-E0001',
      tenantId: '01JD2XORG00000000000000001',
      cachedAt: Date.now(),
    };
    kvStore.set('link:x8Fk2LpQ', JSON.stringify(entry));

    const globalFetch = vi.fn().mockRejectedValue(new Error('Analytics 500 Down'));
    vi.stubGlobal('fetch', globalFetch);

    const req = new Request('https://obg.in/r/x8Fk2LpQ');
    const res = await handleShortLinkRequest(req, env);

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://grid.onebridge.in/acme-steels/sneha-r');

    vi.unstubAllGlobals();
  });

  it('AC-9: edge cache honors 60 second max TTL', async () => {
    const oldEntry: ShortLinkKvEntry = {
      code: 'x8Fk2LpQ',
      destinationUrl: 'https://grid.onebridge.in/acme-steels/old-url',
      status: 'active',
      targetType: 'card',
      targetId: 'OB-7KQ2MX-E0001',
      tenantId: '01JD2XORG00000000000000001',
      cachedAt: Date.now() - 65 * 1000, // 65 seconds ago (stale)
    };
    kvStore.set('link:x8Fk2LpQ', JSON.stringify(oldEntry));

    // When cache is stale (>60s), worker fetches fresh version from origin
    const freshData = {
      code: 'x8Fk2LpQ',
      destinationUrl: 'https://grid.onebridge.in/acme-steels/fresh-url',
      status: 'active',
      targetType: 'card',
      targetId: 'OB-7KQ2MX-E0001',
      tenantId: '01JD2XORG00000000000000001',
    };
    const globalFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(freshData), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );
    vi.stubGlobal('fetch', globalFetch);

    const req = new Request('https://obg.in/r/x8Fk2LpQ');
    const res = await handleShortLinkRequest(req, env);

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://grid.onebridge.in/acme-steels/fresh-url');

    vi.unstubAllGlobals();
  });
});
