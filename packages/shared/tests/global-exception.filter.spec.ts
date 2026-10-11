import { describe, it, expect, vi } from 'vitest';
import { GlobalExceptionFilter } from '../src/global-exception.filter';

describe('AC-10: Global Exception Filter', () => {
  it('should format errors as application/problem+json', () => {
    const filter = new GlobalExceptionFilter();
    const mockJson = vi.fn();
    const mockStatus = vi.fn().mockReturnValue({ json: mockJson });
    
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: mockStatus }),
        getRequest: () => ({ headers: { 'x-correlation-id': '123' } })
      })
    };

    filter.catch(new Error('Test Error'), host);

    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
      type: 'about:blank',
      title: 'Test Error',
      status: 500,
      correlationId: '123'
    }));
  });
});
