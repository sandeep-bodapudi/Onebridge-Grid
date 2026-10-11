import { describe, it, expect } from 'vitest';
import { checkPackageScripts } from '../scripts/check-no-echo-scripts.mjs';

describe('CI Script No-Op and Echo Checker (Condition 7)', () => {
  it('should validate the real workspace packages and ensure no echo test:e2e exists', () => {
    const result = checkPackageScripts();
    if (!result.valid) {
      console.error('Found violations:', result.errors);
    }
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.checkedCount).toBeGreaterThanOrEqual(10);
  });
});
