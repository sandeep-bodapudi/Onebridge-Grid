import { describe, it, expect, vi } from 'vitest';
import { Logger } from '../src/logger';

describe('AC-11: Logging Scrubbing', () => {
  it('should scrub phone numbers and emails from logs and output structured JSON', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const text = 'Contact john.doe@example.com or call +919876543210 immediately.';
    Logger.log(text, { correlationId: '123' });
    
    expect(consoleSpy).toHaveBeenCalled();
    const logOutput = JSON.parse(consoleSpy.mock.calls[0][0]);
    
    expect(logOutput.message).not.toContain('john.doe@example.com');
    expect(logOutput.message).toContain('[REDACTED EMAIL]');
    
    expect(logOutput.message).not.toContain('+919876543210');
    expect(logOutput.message).toContain('[REDACTED PHONE]');
    
    expect(logOutput.correlationId).toBe('123');
    expect(logOutput.level).toBe('info');
    
    consoleSpy.mockRestore();
  });
});
