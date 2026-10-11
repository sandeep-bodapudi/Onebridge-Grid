import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ESLint } from 'eslint';
import * as fs from 'fs';
import * as path from 'path';

describe('Architecture & Module Boundary Tests (Condition 12 & AGENTS.md)', () => {
  const rootDir = process.cwd();
  const identityFixtureDir = path.join(rootDir, 'services/identity/test-fixtures');
  const featureFixtureDir = path.join(rootDir, 'apps/web-app/src/features/auth/test-fixtures');
  const orgSrcDir = path.join(rootDir, 'services/organization/src');

  const identityFixturePath = path.join(identityFixtureDir, 'cross-service.fixture.ts');
  const featureFixturePath = path.join(featureFixtureDir, 'cross-feature.fixture.ts');
  const orgIndexPath = path.join(orgSrcDir, 'index.ts');

  let eslint: ESLint;

  beforeAll(() => {
    eslint = new ESLint();

    // Ensure services/organization has an index.ts target for resolution
    fs.mkdirSync(orgSrcDir, { recursive: true });
    fs.writeFileSync(orgIndexPath, 'export const OrganizationModule = { name: "org" };\n');

    // 1. Create fixture where identity service illegally imports organization service source
    fs.mkdirSync(identityFixtureDir, { recursive: true });
    fs.writeFileSync(
      identityFixturePath,
      `// Illegal boundary import: service importing another service source\nimport { OrganizationModule } from '../../organization/src/index';\nexport const x = OrganizationModule;\n`
    );

    // 2. Create fixture where web-app auth feature illegally imports web-app rbac feature
    fs.mkdirSync(featureFixtureDir, { recursive: true });
    fs.writeFileSync(
      featureFixturePath,
      `// Illegal boundary import: feature importing another feature\nimport { CompanySwitcher } from '../../rbac/CompanySwitcher';\nexport const y = CompanySwitcher;\n`
    );
  });

  afterAll(() => {
    // Clean up temporary fixtures and dummy organization src so workspace pnpm lint remains green
    if (fs.existsSync(identityFixturePath)) fs.unlinkSync(identityFixturePath);
    if (fs.existsSync(identityFixtureDir)) fs.rmdirSync(identityFixtureDir);
    if (fs.existsSync(featureFixturePath)) fs.unlinkSync(featureFixturePath);
    if (fs.existsSync(featureFixtureDir)) fs.rmdirSync(featureFixtureDir);
    if (fs.existsSync(orgIndexPath)) fs.unlinkSync(orgIndexPath);
    if (fs.existsSync(orgSrcDir)) fs.rmdirSync(orgSrcDir);
  });

  it('should prove no ignore rule excludes the boundary fixtures', async () => {
    const isIdentityIgnored = await eslint.isPathIgnored(identityFixturePath);
    const isFeatureIgnored = await eslint.isPathIgnored(featureFixturePath);

    expect(isIdentityIgnored).toBe(false);
    expect(isFeatureIgnored).toBe(false);
  }, 15000);

  it('should flag an error when identity service imports organization service source', async () => {
    const results = await eslint.lintFiles(['services/identity/test-fixtures/cross-service.fixture.ts']);
    expect(results).toHaveLength(1);

    const boundaryErrors = results[0].messages.filter(
      (m) => m.ruleId === 'boundaries/dependencies'
    );

    expect(boundaryErrors.length).toBeGreaterThanOrEqual(1);
    expect(boundaryErrors[0].message).toContain('not allowed');
  }, 15000);

  it('should flag an error when web-app feature imports another feature', async () => {
    const results = await eslint.lintFiles(['apps/web-app/src/features/auth/test-fixtures/cross-feature.fixture.ts']);
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
