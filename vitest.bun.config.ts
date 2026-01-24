import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/e2e/*.test.ts'],
    testTimeout: 30000,
    env: {
      INSTL_BIN: './dist/instl',
    },
  },
});
