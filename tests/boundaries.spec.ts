import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';
import * as path from 'path';

describe('Architecture & Module Boundary Tests (Condition 12 & AGENTS.md)', () => {
  const rootDir = process.cwd();
  const serviceFixturePath = path.join(
    rootDir,
    'tests/fixtures/boundaries/services/svc2/illegal-service-import.ts'
  );
  const featureFixturePath = path.join(
    rootDir,
    'tests/fixtures/boundaries/features/feat2/illegal-feature-import.ts'
  );

  const eslint = new ESLint();

  it('should prove no ignore rule excludes the boundary fixtures', async () => {
    const isServiceIgnored = await eslint.isPathIgnored(serviceFixturePath);
    const isFeatureIgnored = await eslint.isPathIgnored(featureFixturePath);

    expect(isServiceIgnored).toBe(false);
    expect(isFeatureIgnored).toBe(false);
  }, 15000);

  it('should flag an error when a service imports another service source', async () => {
    const results = await eslint.lintFiles([serviceFixturePath]);
    expect(results).toHaveLength(1);

    const boundaryErrors = results[0].messages.filter(
      (m) => m.ruleId === 'boundaries/dependencies'
    );

    expect(boundaryErrors.length).toBeGreaterThanOrEqual(1);
    expect(boundaryErrors[0].message).toContain('not allowed');
  }, 15000);

  it('should flag an error when web-app feature imports another feature', async () => {
    const results = await eslint.lintFiles([featureFixturePath]);
    expect(results).toHaveLength(1);

    const boundaryErrors = results[0].messages.filter(
      (m) => m.ruleId === 'boundaries/dependencies'
    );

    expect(boundaryErrors.length).toBeGreaterThanOrEqual(1);
    expect(boundaryErrors[0].message).toContain('not allowed');
  }, 15000);

  it('should pass cleanly for valid architectural imports (positive control)', async () => {
    const mainServicePath = path.join(rootDir, 'services/identity/src/main.ts');
    const results = await eslint.lintFiles([mainServicePath]);
    expect(results).toHaveLength(1);

    const boundaryErrors = results[0].messages.filter(
      (m) => m.ruleId === 'boundaries/dependencies'
    );
    expect(boundaryErrors).toHaveLength(0);
  }, 15000);
});
