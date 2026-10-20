import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../app/r/[code]/route';

describe('F11: web-public /r/[code] short-link redirect (non-edge hosts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.CARDS_SERVICE_URL = 'http://localhost:4003';
  });

  it('302-redirects to the destination the cards service resolves', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 302, headers: { location: 'https://demo.example/c/acme/sneha' } })
    );
    global.fetch = fetchMock;

    const res = await GET(new Request('http://localhost:3001/r/x8Fk2LpQ'), { params: { code: 'x8Fk2LpQ' } });

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4003/r/x8Fk2LpQ', expect.objectContaining({ redirect: 'manual' }));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://demo.example/c/acme/sneha');
  });

  it('passes through the neutral page for inactive codes without redirecting', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('<html>This card is not active</html>', { status: 200, headers: { 'content-type': 'text/html' } })
    );

    const res = await GET(new Request('http://localhost:3001/r/dead1234'), { params: { code: 'dead1234' } });

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expect(await res.text()).toContain('not active');
  });

  it('URL-encodes the code so it cannot alter the upstream path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    global.fetch = fetchMock;

    await GET(new Request('http://localhost:3001/r/x'), { params: { code: '../admin?x=1' } });

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4003/r/..%2Fadmin%3Fx%3D1');
  });

  it('returns 503 with a friendly message when the cards service is unreachable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED 10.0.0.5'));

    const res = await GET(new Request('http://localhost:3001/r/x8Fk2LpQ'), { params: { code: 'x8Fk2LpQ' } });

    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain('ECONNREFUSED');
  });
});
