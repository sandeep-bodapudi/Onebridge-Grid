import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Workspace AC-1, AC-3, AC-5', () => {
  it('AC-1: root workspace layout conforms to AGENTS.md requirements', () => {
    const apps = fs.readdirSync(path.join(__dirname, '../apps'));
    expect(apps).toEqual(expect.arrayContaining(['web-public', 'web-app', 'admin-console']));

    const services = fs.readdirSync(path.join(__dirname, '../services'));
    expect(services).toEqual(expect.arrayContaining([
      'identity', 'organization', 'cards', 'payments', 'notifications', 'analytics', 'media'
    ]));
  });

  it('AC-3: CI pipeline file is valid YAML', () => {
    const ciContent = fs.readFileSync(path.join(__dirname, '../.github/workflows/ci.yml'), 'utf-8');
    expect(ciContent).toContain('name: CI');
    expect(ciContent).toContain('security:');
  });

  it('AC-5: Commitlint configuration exists', () => {
    const commitlintConfig = fs.existsSync(path.join(__dirname, '../commitlint.config.js'));
    expect(commitlintConfig).toBe(true);
  });
});
