import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 5000, // 5 seconds timeout
    include: [
      'tests/**/*.test.{ts,tsx}', // Test files in the tests directory
    ],
    exclude: [
      'tests/e2e/**', // Exclude E2E tests (these are run with Playwright)
    ],
  },
});