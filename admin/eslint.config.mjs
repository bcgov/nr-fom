import tseslint from 'typescript-eslint'
import angular from '@angular-eslint/eslint-plugin'
import angularTemplate from '@angular-eslint/eslint-plugin-template'
import angularParser from '@angular-eslint/template-parser'
import prettier from 'eslint-config-prettier'

export default [
  {
    ignores: ['projects/**/*', 'dist/**', 'node_modules/**', 'coverage/**'],
  },
  ...tseslint.configs['recommended'],
  {
    files: ['**/*.ts'],
    plugins: { '@angular-eslint': angular },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: 'tsconfig.json', createDefaultProgram: true },
    },
    rules: {
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
  },
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'prefer-const': 'off',
      '@angular-eslint/component-selector': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
    },
  },
  prettier,
]