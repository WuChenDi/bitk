import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'app',
    typescript: true,
    stylistic: false,
    ignores: [
      'node_modules',
      'frontend/**',
      'vibe/**',
      'drizzle/**',
      '.github/**',
      'AGENTS.md',
      'CLAUDE.md',
      'README.md',
      '*.json',
    ],
  },
  {
    files: ['app/**/*.ts'],
    rules: {
      'no-console': 'off',
      'node/prefer-global/process': 'off',
    },
  },
)
