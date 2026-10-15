import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

// regras do padrão do projeto: any e tipos de retorno explícitos ficam desligados
export default [
  { ignores: ['out/**', 'node_modules/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...Object.assign(
        {},
        ...tsPlugin.configs['flat/recommended'].map(
          config => config.rules ?? {}
        )
      ),
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off'
    }
  }
]
