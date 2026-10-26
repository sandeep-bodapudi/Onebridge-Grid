import { Logger } from './logger.js';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  correlationId: string;
}

export class ProblemException extends Error {
  public problem: ProblemDetails;
  public status: number;

  constructor(status: number, title: string, detail: string, correlationId: string, type = 'https://tools.ietf.org/html/rfc7807') {
    super(detail || title);
    this.status = status;
    this.problem = {
      type,
      title,
      status,
      detail,
      correlationId,
    };
  }
}

export interface ExecutionContextLike {
  switchToHttp(): {
    getResponse(): {
      status(code: number): { json(body: unknown): void };
      setHeader?(name: string, value: string): void;
    };
    getRequest(): { headers: Record<string, string | undefined> };
  };
}

export class GlobalExceptionFilter {
  catch(exception: Error | ProblemException | unknown, host: ExecutionContextLike) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const correlationId = request.headers['x-correlation-id'] || 'unknown';

    if (typeof response.setHeader === 'function') {
      response.setHeader('content-type', 'application/problem+json');
    }

    if (exception && typeof exception === 'object' && 'problem' in exception && (exception as ProblemException).problem) {
      const prob = (exception as ProblemException).problem;
      if (!prob.correlationId || prob.correlationId === 'unknown') {
        prob.correlationId = correlationId;
      }
      return response.status((exception as ProblemException).status).json(prob);
    }

    if (exception && typeof exception === 'object' && 'getResponse' in exception && typeof (exception as { getResponse: () => unknown }).getResponse === 'function') {
      const nestException = exception as { getResponse: () => unknown; getStatus?: () => number };
      const status = typeof nestException.getStatus === 'function' ? nestException.getStatus() : 500;
      const resp = nestException.getResponse();
      const fallbackMsg = exception instanceof Error ? exception.message : 'Error';

      if (typeof resp === 'object' && resp !== null) {
        const respObj = resp as Record<string, unknown>;
        return response.status(status).json({
          type: respObj.type || 'https://tools.ietf.org/html/rfc7807',
          title: respObj.title || respObj.error || 'Error',
          status,
          detail: respObj.detail || (Array.isArray(respObj.message) ? respObj.message.join(', ') : respObj.message) || fallbackMsg,
          correlationId: (respObj.correlationId as string) || correlationId,
          // RFC 7807 extension members the clients act on: a machine-readable code
          // (e.g. wrong_person, over_limit) and numeric hints. Nothing else is passed through.
          ...(typeof respObj.code === 'string' && /^[a-z][a-z0-9_]{0,40}$/.test(respObj.code) ? { code: respObj.code } : {}),
          ...(typeof respObj.retryAfterSeconds === 'number' ? { retryAfterSeconds: respObj.retryAfterSeconds } : {}),
          ...(typeof respObj.limit === 'number' ? { limit: respObj.limit } : {}),
        });
      }

      return response.status(status).json({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: String(resp),
        status,
        detail: fallbackMsg || String(resp),
        correlationId,
      });
    }

    // Unexpected error: log the real message and stack server-side, but never
    // send them to the client (they can carry database errors, file paths or
    // personal data). The correlation ID ties the response to the log line.
    const err = exception instanceof Error ? exception : new Error(String(exception));
    Logger.error(`Unhandled error: ${err.message}`, {
      correlationId,
      errorName: err.name,
      stack: err.stack ? Logger.scrub(err.stack) : undefined,
    });

    const problemDetails: ProblemDetails = {
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: `Something went wrong on our side. Try again in a moment. If it keeps happening, contact support with reference ${correlationId}.`,
      correlationId,
    };

    response.status(500).json(problemDetails);
  }
}
