import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 5000, // 5秒でタイムアウト
    include: [
      'tests/**/*.test.{ts,tsx}', // testsディレクトリのテストファイル
    ],
  },
});