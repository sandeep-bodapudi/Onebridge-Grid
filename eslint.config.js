import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import i18next from 'eslint-plugin-i18next';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.next/**',
      '**/.tmp/**',
      '**/storybook-static/**',
      'scripts/**',
      '**/*.mjs',
      'commitlint.config.js',
      'vitest.workspace.ts',
      'eslint.config.js',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      boundaries,
      i18next
    },
    settings: {
      'boundaries/elements': [
        { type: 'service', pattern: 'services/*' },
        { type: 'feature', pattern: 'apps/web-app/src/features/*' },
        { type: 'shared', pattern: 'packages/shared/*' }
      ]
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              from: 'service',
              allow: ['shared', 'api-contracts']
            }
          ]
        }
      ],
      'i18next/no-literal-string': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off'
    }
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['packages/shared/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'mongodb',
              message:
                'Direct import of "mongodb" is strictly prohibited outside packages/shared. Consume TenantScopedRepository or GlobalRepository from @onebridge/shared.',
            },
          ],
        },
      ],
    },
  }
);
