import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      '**/.next/**',
      '**/node_modules/**',
      '**/next-env.d.ts',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      'pnpm-lock.yaml',
    ],
  },
  {
    settings: { next: { rootDir: 'apps/web/' } },
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
];

export default config;
