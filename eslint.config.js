import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

const commonRules = {
  ...js.configs.recommended.rules,
  'no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
}

export default [
  {
    ignores: [
      'dist',
      'functions/node_modules',
      '.firebase',
      'playwright-report',
      'test-results',
      'public/firebase-messaging-sw.js',
    ],
  },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...commonRules,
      // Only the two long-established hook rules — eslint-plugin-react-hooks v7's
      // "recommended" pulls in the React Compiler-era strict ruleset (purity,
      // immutability, set-state-in-render, …), which is a different, much larger
      // conversation than "wire up basic linting" for an existing codebase.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['functions/**/*.js', 'scripts/**/*.js', 'e2e/**/*.{js,ts}', '*.config.{js,ts}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: commonRules,
  },
]
