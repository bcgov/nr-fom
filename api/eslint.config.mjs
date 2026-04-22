import { baseIgnores, baseRules, typescriptRules } from '../eslint-base.config.mjs'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default [
  {
    ignores: [...baseIgnores, '.eslintrc.js'],
  },
  ...tseslint.configs['recommended'],
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: 'tsconfig.json',
        sourceType: 'module',
      },
    },
  },
  {
    rules: {
      ...baseRules,
      ...typescriptRules,
      '@typescript-eslint/interface-name-prefix': 'off',
    },
  },
  prettier,
]