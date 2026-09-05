import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const database = join(mkdtempSync(join(tmpdir(), 'costage-e2e-')), 'test.sqlite');
export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3103',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: [
        '--no-sandbox',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ],
    },
  },
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:3103/api/health',
    reuseExistingServer: false,
    env: { PORT: '3103', DATABASE_PATH: database, ALLOWED_ORIGINS: 'http://127.0.0.1:3103' },
    timeout: 30000,
  },
});
