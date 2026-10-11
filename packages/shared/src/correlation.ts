export interface CorrelationRequest {
  headers?: Record<string, string | string[] | undefined>;
}

export interface CorrelationResponse {
  setHeader?: (name: string, value: string) => void;
}

export const correlationIdMiddleware = (
  req: CorrelationRequest,
  _res: CorrelationResponse,
  next: () => void
) => {
  req.headers = req.headers || {};
  if (!req.headers['x-correlation-id']) {
    req.headers['x-correlation-id'] = 'generated-id';
  }
  next();
};
