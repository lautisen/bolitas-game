import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      '.vite/',
      '.firebase/',
      'public/',
      'dist/',
      'android/',
      'ios/',
      'node_modules/',
      'promo/',
      'resources/',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['tests/**/*.js', '*.config.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  prettier,
];
