import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { POST } from '../app/api/revalidate/route';

afterEach(() => vi.unstubAllEnvs());

describe('D-VPS-DEPLOY B1: revalidation secret', () => {
  it('refuses in production when REVALIDATION_SIGNING_SECRET is not set', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('REVALIDATION_SIGNING_SECRET', '');
    const req = new Request('http://localhost/api/revalidate', { method: 'POST', headers: { 'x-signature': 'x', 'x-timestamp': String(Date.now()) }, body: '{}' });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(503);
  });
});
