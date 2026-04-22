import tseslint from 'typescript-eslint'
import angular from '@angular-eslint/eslint-plugin'
import angularTemplate from '@angular-eslint/eslint-plugin-template'
import angularParser from '@angular-eslint/template-parser'
import prettier from 'eslint-config-prettier'
import { baseIgnores, baseRules, typescriptRules } from '../eslint-base.config.mjs'

export default [
  {
    ignores: ['projects/**/*', ...baseIgnores],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    plugins: { '@angular-eslint': angular },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: 'tsconfig.json', createDefaultProgram: true },
    },
    rules: {
      ...baseRules,
      ...typescriptRules,
      '@angular-eslint/component-selector': [
        'error',
        { prefix: 'app', style: 'kebab-case', type: 'element' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { prefix: 'app', style: 'camelCase', type: 'attribute' },
      ],
    },
  },
  {
    files: ['**/*.html'],
    plugins: { '@angular-eslint/template': angularTemplate },
    languageOptions: { parser: angularParser },
    rules: {},
  },
  prettier,
]