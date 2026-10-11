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
      'commitlint.config.js',
      'eslint.config.mjs',
      'scripts/test-identity-server.mjs',
      'services/identity/test-server.mjs',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      boundaries,
      i18next,
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.ts', '.tsx', '.js', '.jsx'],
        },
      },
      'boundaries/elements': [
        { type: 'service', pattern: 'services/*' },
        { type: 'feature', pattern: 'apps/web-app/src/features/*' },
        { type: 'shared', pattern: 'packages/shared' },
        { type: 'api-contracts', pattern: 'packages/api-contracts' },
        { type: 'ui-kit', pattern: 'packages/ui-kit' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            {
              from: { element: { type: 'service' } },
              disallow: [{ to: { element: { type: 'service' } } }],
            },
            {
              from: { element: { type: 'feature' } },
              disallow: [
                { to: { element: { type: 'feature' } } },
                { to: { element: { type: 'service' } } },
              ],
            },
          ],
        },
      ],
      'i18next/no-literal-string': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-empty-object-type': 'error',
      '@typescript-eslint/no-unsafe-function-type': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
          minimumDescriptionLength: 5,
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression[typeAnnotation.type="TSNeverKeyword"]',
          message: 'The use of "as never" is strictly forbidden. Use explicit typed casts.',
        },
      ],
    },
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
