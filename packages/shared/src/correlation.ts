export interface CorrelationRequest {
  headers?: Record<string, string | string[] | undefined>;
}

export interface CorrelationResponse {
  setHeader?: (name: string, value: string) => void;
}

export const correlationIdMiddleware = (
  req: CorrelationRequest,
  res: CorrelationResponse,
  next: () => void
) => {
  req.headers = req.headers || {};
  let cid = req.headers['x-correlation-id'] as string | undefined;
  if (!cid) {
    cid = `corr-${Math.random().toString(36).substring(2, 12)}`;
    req.headers['x-correlation-id'] = cid;
  }
  if (typeof res?.setHeader === 'function') {
    res.setHeader('x-correlation-id', cid);
  }
  next();
};
