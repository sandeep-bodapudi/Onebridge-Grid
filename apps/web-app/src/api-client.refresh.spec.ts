import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiClient } from './api-client';

describe('apiClient.silentRefresh', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    apiClient.clear();
  });

  it('shares one in-flight request between concurrent callers (refresh-token reuse would revoke the session)', async () => {
    let resolveFetch: (r: Response) => void = () => {};
    const fetchMock = vi.fn(
      () => new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const first = apiClient.silentRefresh();
    const second = apiClient.silentRefresh();
    resolveFetch(new Response(JSON.stringify({ accessToken: 'tok-1' }), { status: 200 }));

    await expect(Promise.all([first, second])).resolves.toEqual(['tok-1', 'tok-1']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(apiClient.getAccessToken()).toBe('tok-1');
  });

  it('allows a new refresh after the previous one settled', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: 'tok-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: 'tok-2' }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await apiClient.silentRefresh();
    await expect(apiClient.silentRefresh()).resolves.toBe('tok-2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null (not an exception) when the session has ended', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 401 })) as unknown as typeof fetch;
    await expect(apiClient.silentRefresh()).resolves.toBeNull();
  });
});
