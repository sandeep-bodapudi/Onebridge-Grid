export const correlationIdMiddleware = (req: any, res: any, next: () => void) => {
  req.headers = req.headers || {};
  if (!req.headers['x-correlation-id']) {
    req.headers['x-correlation-id'] = 'generated-id';
  }
  next();
};
