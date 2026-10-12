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

    const err = exception instanceof Error ? exception : new Error(String(exception));
    const problemDetails: ProblemDetails = {
      type: 'about:blank',
      title: err.message || 'Internal Server Error',
      status: 500,
      detail: err.message || 'An unexpected error occurred',
      correlationId,
    };

    response.status(500).json(problemDetails);
  }
}
