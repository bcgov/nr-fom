import { FlatCompat } from '@eslint/eslint-plugin'
import angular from 'angular-eslint'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
})

const extendsBase = [
  ...tsseslint.configs['recommended'],
  ...angular.configs['recommended'],
  ...angular.configs['template'],
]

export default [
  {
    ignores: ['projects/**/*', 'dist/**', 'node_modules/**', 'coverage/**'],
  },
  ...extendsBase.map((config) => ({
    ...config,
    files: ['**/*.ts'],
  })),
  ...angular.configs['template'].map((config) => ({
    ...config,
    files: ['**/*.html'],
  })),
  {
    files: ['**/*.ts'],
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
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: 'tsconfig.json',
        createDefaultProgram: true,
      },
    },
  },
  {
    rules: {
      'prettier/prettier': 'error',
    },
  },
  prettier,
]