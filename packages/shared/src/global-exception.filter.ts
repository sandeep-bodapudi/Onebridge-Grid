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

export class GlobalExceptionFilter {
  catch(exception: Error | ProblemException, host: any) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    if ('problem' in exception && exception.problem) {
      return response.status(exception.status).json(exception.problem);
    }

    const problemDetails: ProblemDetails = {
      type: 'about:blank',
      title: exception.message || 'Internal Server Error',
      status: 500,
      detail: exception.stack || '',
      correlationId: request.headers['x-correlation-id'] || 'unknown',
    };

    response.status(500).json(problemDetails);
  }
}
