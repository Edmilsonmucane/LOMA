import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: [
      'packages/**/*.test.{ts,tsx}',
      'apps/web/src/lib/domain/*.test.ts',
    ],
    setupFiles: ['./vitest.setup.ts'],
    coverage: { provider: 'v8', include: ['packages/ui/src/theme.ts'] },
  },
});
