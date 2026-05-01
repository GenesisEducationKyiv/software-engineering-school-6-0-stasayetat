import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import importPlugin from 'eslint-plugin-import';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/.build/**', '**/*.js']),

  {
    files: ['**/*.ts'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      import: importPlugin,
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
      '@stylistic': stylistic,
    },
    rules: {
      // general
      'no-console': 'warn',
      'curly': 'error',
      'brace-style': ['error', '1tbs', { allowSingleLine: false }],
      'no-constant-condition': ['error', { checkLoops: false }],
      'object-shorthand': 'error',
      'no-unsafe-finally': 'off',
      'implicit-arrow-linebreak': 'warn',

      // imports
      'import/no-unresolved': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'unused-imports/no-unused-imports': 'error',

      // typescript
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/return-await': ['error', 'always'],
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',
      '@typescript-eslint/no-restricted-types': ['error', { types: { Error: true } }],
      '@typescript-eslint/restrict-template-expressions': ['error', {
        allowNumber: true,
        allowBoolean: true,
        allowNullish: true,
      }],

      // stylistic
      '@stylistic/lines-between-class-members': ['error', {
        enforce: [
          { blankLine: 'always', prev: 'field', next: 'method' },
          { blankLine: 'always', prev: 'method', next: '*' },
        ],
      }],
      '@stylistic/padding-line-between-statements': ['error',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
        { blankLine: 'always', prev: '*', next: 'block-like' },
      ],
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
    },
  },

  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      'import/no-internal-modules': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },

  eslintConfigPrettier,
]);
