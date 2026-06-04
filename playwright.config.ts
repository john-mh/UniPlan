import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './server/tests',
  testMatch: '**/*.{test,spec}.ts',
  testIgnore: '**/defense-acid.spec.ts',
  timeout: 90000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    headless: false,
    screenshot: 'only-on-failure',
  },
});
