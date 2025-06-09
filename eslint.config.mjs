import js from '@eslint/js';
import markdown from '@eslint/markdown';
import { defineConfig } from 'eslint/config';
import importPlugin from 'eslint-plugin-import';
import sort from 'eslint-plugin-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    extends: ['js/recommended'],
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: { js },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: { globals: globals.node },
  },
  tseslint.configs.recommended,
  {
    extends: ['markdown/recommended'],
    files: ['**/*.md'],
    language: 'markdown/commonmark',
    plugins: { markdown },
  },
  importPlugin.flatConfigs.recommended,
  sort.configs['flat/recommended'],
  {
    rules: {
      'import/no-duplicates': 'error',
      'import/no-unresolved': 'off',
      'sort/exports': 'off',
      'sort/imports': [
        'error',
        {
          groups: [
            { order: 20, type: 'side-effect' },
            { order: 10, type: 'dependency' },
            { order: 30, regex: '^.+\\.s?css$' },
            { order: 40, type: 'other' },
          ],
          separator: '\n',
        },
      ],
      'sort/string-enums': ['error'],
      'sort/string-unions': ['error'],
      'sort/type-properties': ['error'],
    },
  },
]);
