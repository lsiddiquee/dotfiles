import { defineConfig } from '@playwright/test';

const port = process.env.MODEL_REVIEW_TEST_PORT ?? '43127';
export default defineConfig({
  testDir: './test', testMatch: '**/*.ui.mjs', workers: 1,
  use: { baseURL: `http://127.0.0.1:${port}`, headless: true },
  webServer: { command: 'node test/serve.mjs', url: `http://127.0.0.1:${port}`, reuseExistingServer: false },
});
