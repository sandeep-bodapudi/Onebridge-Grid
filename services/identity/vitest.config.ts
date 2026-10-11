import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import path from 'node:path';

export default defineConfig({
  plugins: [
    swc.vite({
      tsconfigFile: './tsconfig.json',
    }),
  ],
  oxc: false,
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts', 'tests/**/*.test.ts'],
    setupFiles: [path.resolve(import.meta.dirname, '../../tests/setup-mongo.ts')],
  },
});

