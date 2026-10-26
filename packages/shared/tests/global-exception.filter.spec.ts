import { describe, it, expect, vi, afterEach } from 'vitest';
import { GlobalExceptionFilter } from '../src/global-exception.filter';

function makeHost() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ headers: { 'x-correlation-id': '123' } as Record<string, string | undefined> }),
    }),
  };
  return { host, status, json };
}

describe('AC-10: Global Exception Filter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('formats unexpected errors as application/problem+json with status 500', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { host, status, json } = makeHost();

    new GlobalExceptionFilter().catch(new Error('Test Error'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        correlationId: '123',
      })
    );
  });

  it('never sends the internal error message or stack to the client', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { host, json } = makeHost();

    new GlobalExceptionFilter().catch(
      new Error('MongoServerError: connection refused at 10.0.0.5:27017'),
      host
    );

    const body = JSON.stringify(json.mock.calls[0][0]);
    expect(body).not.toContain('MongoServerError');
    expect(body).not.toContain('10.0.0.5');
    expect(body).toContain('reference 123');
  });

  it('logs the real error server-side with the correlation ID', () => {
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { host } = makeHost();

    new GlobalExceptionFilter().catch(new Error('Test Error'), host);

    const logged = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(logged.level).toBe('error');
    expect(logged.message).toContain('Test Error');
    expect(logged.correlationId).toBe('123');
  });

  it('passes through a safe machine-readable code and numeric hints, and nothing else', () => {
    const { host, json } = makeHost();
    const exception = {
      getStatus: () => 403,
      getResponse: () => ({
        title: 'Forbidden',
        detail: 'Sign in with the invited number.',
        code: 'wrong_person',
        retryAfterSeconds: 30,
        limit: 50,
        stack: 'secret',
        personPhone: '+919820012345',
      }),
    };

    new GlobalExceptionFilter().catch(exception, host);

    const body = json.mock.calls[0][0] as Record<string, unknown>;
    expect(body.code).toBe('wrong_person');
    expect(body.retryAfterSeconds).toBe(30);
    expect(body.limit).toBe(50);
    expect(body).not.toHaveProperty('stack');
    expect(body).not.toHaveProperty('personPhone');
  });

  it('drops a code that is not a simple identifier', () => {
    const { host, json } = makeHost();
    new GlobalExceptionFilter().catch({ getStatus: () => 400, getResponse: () => ({ title: 'Bad', code: '<script>' }) }, host);
    expect(json.mock.calls[0][0]).not.toHaveProperty('code');
  });
});
