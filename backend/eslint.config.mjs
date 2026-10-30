// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/', 'src/generated/', 'coverage/', 'prisma/migrations/'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
    },
  },
  {
    // Layering rule (spec §2): only services (and infra in config/, prisma/seed, tests) may touch the Prisma client.
    files: ['src/**/*.ts'],
    // server.ts is the composition root (disconnects Prisma on shutdown).
    ignores: ['src/**/*.service.ts', 'src/config/prisma.ts', 'src/lib/**/*.ts', 'src/server.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/config/prisma', '**/config/prisma.js'],
              message: 'Only *.service.ts may use Prisma.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.mjs', 'scripts/**'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['tests/**/*.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off', // supertest bodies are untyped JSON
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
);
