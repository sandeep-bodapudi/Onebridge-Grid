import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..');
const mongoDownloadDir = path.resolve(repoRoot, '.tmp/mongodb-binaries');

if (!fs.existsSync(mongoDownloadDir)) {
  fs.mkdirSync(mongoDownloadDir, { recursive: true });
}

process.env.MONGOMS_DOWNLOAD_DIR = mongoDownloadDir;
process.env.MONGOMS_VERSION = '7.0.14';
