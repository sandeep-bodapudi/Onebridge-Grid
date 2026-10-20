import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..');
const mongoDownloadDir = path.resolve(repoRoot, '.tmp/mongodb-binaries');
const mongoTmpDir = path.resolve(repoRoot, '.tmp/mongo-tmp');

if (!fs.existsSync(mongoDownloadDir)) {
  fs.mkdirSync(mongoDownloadDir, { recursive: true });
}
if (!fs.existsSync(mongoTmpDir)) {
  fs.mkdirSync(mongoTmpDir, { recursive: true });
}

process.env.MONGOMS_DOWNLOAD_DIR = mongoDownloadDir;
process.env.MONGOMS_VERSION = '7.0.14';
process.env.TMP = mongoTmpDir;
process.env.TEMP = mongoTmpDir;
process.env.TMPDIR = mongoTmpDir;
