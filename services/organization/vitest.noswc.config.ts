import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({ test: { globals: true, environment: 'node', fileParallelism: false, include: ['tests/free-plan.spec.ts','tests/invites.spec.ts'], setupFiles: [path.resolve(import.meta.dirname, '../../tests/setup-mongo.ts')] } });
