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
        entry.name === '.next' ||
        entry.name === '.tmp' ||
        entry.name === 'storybook-static'
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
      if (typeof scriptCmd !== 'string') continue;
      const trimmed = scriptCmd.trim().toLowerCase();

      // Check for banned dummy / no-op scripts
      if (
        trimmed.startsWith('echo ') ||
        trimmed === 'echo' ||
        trimmed === 'true' ||
        trimmed === 'exit 0' ||
        trimmed === ':' ||
        trimmed.includes('--passwithnotests')
      ) {
        errors.push(
          `Package "${pkg.name || relPath}" defines a banned dummy/no-op in script "${scriptName}": "${scriptCmd}".`
        );
      }
    }

    // If package has a src/ folder (except root), require real typecheck and test scripts
    const pkgDir = path.dirname(filePath);
    const srcDir = path.join(pkgDir, 'src');
    const isRoot = path.resolve(pkgDir) === path.resolve(baseDir);

    if (!isRoot && fs.existsSync(srcDir)) {
      const srcFiles = fs.readdirSync(srcDir);
      if (srcFiles.length > 0) {
        if (!scripts.typecheck) {
          errors.push(
            `Package "${pkg.name || relPath}" contains a "src" directory but is missing required "typecheck" script.`
          );
        }
        if (!scripts.test) {
          errors.push(
            `Package "${pkg.name || relPath}" contains a "src" directory but is missing required "test" script.`
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
