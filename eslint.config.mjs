import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'coverage'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      // TypeScript already validates identifiers; no-undef can't see TS types in SFCs.
      'no-undef': 'off',
    },
  },
  {
    languageOptions: {
      // Browser globals used by the app (no `globals` package dependency).
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        location: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      'no-console': ['warn', { allow: ['info', 'warn', 'error'] }],
      // Formatting is owned by Prettier — disable conflicting vue style rules.
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-indent': 'off',
      'vue/html-self-closing': 'off',
    },
  },
)
