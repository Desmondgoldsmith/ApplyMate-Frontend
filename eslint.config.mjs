import { defineConfig, globalIgnores } from 'eslint/config';
import eslint from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const webFiles = ['packages/web/**/*.{ts,tsx,js,jsx,mjs}'];
const extAndSharedFiles = [
  'packages/extension/**/*.{ts,tsx}',
  'shared/**/*.{ts,tsx}',
  'packages/extension/**/*.mjs',
];

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/out/**',
    '**/build/**',
    '**/coverage/**',
    'next-env.d.ts',
    'packages/web/next-env.d.ts',
    '**/postcss.config.mjs',
  ]),
  {
    files: webFiles,
    settings: {
      next: {
        rootDir: 'packages/web',
      },
    },
  },
  ...nextVitals.map((c) => ({ ...c, files: webFiles })),
  ...nextTs.map((c) => ({ ...c, files: webFiles })),
  {
    files: webFiles,
    rules: {
      /**
       * React Compiler lint (Next 16) — off for now on legacy UI patterns
       * (modal reset on open, localStorage hydrate, menu positioning, etc.).
       * Re-enable incrementally as components are refactored.
       */
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/globals': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ...eslint.configs.recommended,
    files: extAndSharedFiles,
  },
  ...tseslint.configs.recommended.map((c) => ({ ...c, files: extAndSharedFiles })),
  {
    files: extAndSharedFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  eslintConfigPrettier,
]);
