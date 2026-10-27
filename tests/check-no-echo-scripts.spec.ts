import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { checkPackageScripts } from '../scripts/check-no-echo-scripts.mjs';

describe('CI Script No-Op and Echo Checker (Condition 7 & Evidence Rule §13)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-scripts-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should validate the real workspace packages and ensure no banned dummy scripts exist', () => {
    const result = checkPackageScripts();
    if (!result.valid) {
      console.error('Found violations:', result.errors);
    }
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.checkedCount).toBe(19);
  });

  it('should fail if any script defines echo', () => {
    const pkgDir = path.join(tempDir, 'services', 'dummy');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({ name: 'dummy', scripts: { test: "echo 'test'" } })
    );

    const result = checkPackageScripts(tempDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('banned dummy/no-op in script "test"'))).toBe(true);
  });

  it('should fail if any script defines true, exit 0, :, or --passWithNoTests', () => {
    const bannedCommands = ['true', 'exit 0', ':', 'vitest run --passWithNoTests'];
    for (const cmd of bannedCommands) {
      const pkgDir = path.join(tempDir, 'services', 'dummy-' + Math.random().toString(36).substring(7));
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(
        path.join(pkgDir, 'package.json'),
        JSON.stringify({ name: 'dummy', scripts: { build: cmd } })
      );

      const result = checkPackageScripts(tempDir);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('banned dummy/no-op in script "build"'))).toBe(true);
    }
  });

  it('should fail if a package contains a src directory but is missing typecheck or test', () => {
    const pkgDir = path.join(tempDir, 'packages', 'has-src');
    fs.mkdirSync(path.join(pkgDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'src', 'index.ts'), 'export const a = 1;');
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({ name: 'has-src', scripts: {} })
    );

    const result = checkPackageScripts(tempDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('missing required "typecheck" script'))).toBe(true);
    expect(result.errors.some((e: string) => e.includes('missing required "test" script'))).toBe(true);
  });
});
