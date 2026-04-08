/**
 * Shared ESLint base configuration
 * Contains common rules and ignore patterns used by both backend and frontend
 * 
 * Each project imports this base and extends with custom config
 * 
 * Usage:
 *   import { baseIgnores, baseRules } from '../../eslint-base.config.mjs'
 */

import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export const baseIgnores = [
  '**/dist/**',
  '**/node_modules/**',
  '**/coverage/**',
  '**/*.js',
  '**/*.js.map',
  '**/.eslintrc.json',
  '**/.eslintrc.js',
]

export const baseRules = {
  'prettier/prettier': 'error',
  'no-console': 'off',
  'no-debugger': 'warn',
  'no-unused-vars': 'off',
  'no-empty': ['error', { allowEmptyCatch: true }],
}

export const typescriptRules = {
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  '@typescript-eslint/explicit-module-boundary-types': 'off',
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/no-non-null-assertion': 'off',
  '@typescript-eslint/no-empty-interface': 'off',
  '@typescript-eslint/ban-types': 'off',
  '@typescript-eslint/explicit-function-return-type': 'off',
}