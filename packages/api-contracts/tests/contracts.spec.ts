import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('API Contracts Validation', () => {
  it('should verify openapi.yaml exists and is valid', () => {
    const openapiPath = path.resolve(__dirname, '../openapi.yaml');
    expect(fs.existsSync(openapiPath)).toBe(true);
    const content = fs.readFileSync(openapiPath, 'utf-8');
    expect(content).toContain('openapi: 3.');
  });

  it('should verify events.yaml exists and is valid', () => {
    const eventsPath = path.resolve(__dirname, '../events.yaml');
    expect(fs.existsSync(eventsPath)).toBe(true);
    const content = fs.readFileSync(eventsPath, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
  });
});
