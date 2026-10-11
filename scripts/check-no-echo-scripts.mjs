import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export function checkPackageScripts(baseDir = rootDir) {
  const errors = [];
  const checkedPackages = [];

  function findPackageJsonFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === 'dist' ||
        entry.name === '.next'
      ) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const pkgJsonPath = path.join(fullPath, 'package.json');
        if (fs.existsSync(pkgJsonPath)) {
          inspectPackageJson(pkgJsonPath);
        }
        findPackageJsonFiles(fullPath);
      }
    }
  }

  function inspectPackageJson(filePath) {
    const relPath = path.relative(baseDir, filePath);
    checkedPackages.push(relPath);

    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      errors.push(`Invalid JSON in ${relPath}: ${err.message}`);
      return;
    }

    const scripts = pkg.scripts || {};
    for (const [scriptName, scriptCmd] of Object.entries(scripts)) {
      const trimmed = scriptCmd.trim().toLowerCase();
      // Banned echo/no-ops for test:e2e
      if (scriptName === 'test:e2e') {
        if (
          trimmed.startsWith('echo ') ||
          trimmed === 'exit 0' ||
          trimmed === ':' ||
          trimmed === 'true'
        ) {
          errors.push(
            `Package "${pkg.name || relPath}" contains a dummy/no-op "${scriptName}" script: "${scriptCmd}". Packages with nothing to test must not define test:e2e.`
          );
        }
      }

      // Any script that is an echo placeholder for a test
      if (scriptName.startsWith('test') && trimmed.startsWith('echo ')) {
        // test:e2e is already caught; flag any dummy echo test
        if (scriptName === 'test:e2e') {
          // already added
        } else if (trimmed.includes('test:e2e')) {
          errors.push(
            `Package "${pkg.name || relPath}" defines an echo placeholder in "${scriptName}": "${scriptCmd}"`
          );
        }
      }
    }
  }

  // Check root package.json
  const rootPkgPath = path.join(baseDir, 'package.json');
  if (fs.existsSync(rootPkgPath)) {
    inspectPackageJson(rootPkgPath);
  }

  // Check subpackages in apps, services, packages, edge
  for (const workspaceDir of ['apps', 'services', 'packages', 'edge']) {
    const fullWorkspaceDir = path.join(baseDir, workspaceDir);
    if (fs.existsSync(fullWorkspaceDir)) {
      findPackageJsonFiles(fullWorkspaceDir);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    checkedCount: checkedPackages.length,
    checkedPackages,
  };
}

if (process.argv[1] === __filename) {
  const result = checkPackageScripts();
  if (!result.valid) {
    console.error('CI No-op Check FAILED with the following violations:');
    for (const err of result.errors) {
      console.error(` - ${err}`);
    }
    process.exit(1);
  } else {
    console.log(`CI No-op Check PASSED across ${result.checkedCount} package files.`);
  }
}
