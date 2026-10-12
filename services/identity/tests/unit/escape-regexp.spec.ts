import { describe, it, expect } from 'vitest';
import { escapeRegExp } from '../../src/infrastructure/repositories/mongo-person.repository.js';

describe('escapeRegExp Unit Tests', () => {
  it('leaves alphanumeric characters unchanged', () => {
    expect(escapeRegExp('test123user')).toBe('test123user');
    expect(escapeRegExp('john.doe@company.com')).toBe('john\\.doe@company\\.com');
  });

  it('escapes all RegExp metacharacters', () => {
    const metacharacters = '.*+?^${}()|[]\\';
    const escaped = escapeRegExp(metacharacters);
    expect(escaped).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');

    // Confirm that creating a RegExp with the escaped string matches the literal string exactly
    const re = new RegExp(`^${escaped}$`);
    expect(re.test(metacharacters)).toBe(true);
    expect(re.test('anything_else')).toBe(false);
  });

  it('safely handles complex email addresses with tags and symbols', () => {
    const email = 'user+test[1](2){3}*tag^$|?@domain.co.uk';
    const escaped = escapeRegExp(email);
    const re = new RegExp(`^${escaped}$`, 'i');

    expect(re.test('user+test[1](2){3}*tag^$|?@domain.co.uk')).toBe(true);
    expect(re.test('USER+TEST[1](2){3}*TAG^$|?@DOMAIN.CO.UK')).toBe(true);
    expect(re.test('user_test123tag@domain.co.uk')).toBe(false);
  });
});
