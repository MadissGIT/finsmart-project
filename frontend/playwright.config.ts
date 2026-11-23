import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT || 5173);

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/*.integration.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:' + port, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: [
    {
      command: 'node --experimental-strip-types e2e/api-fixture.ts',
      url: 'http://127.0.0.1:18080/api/v1/health/ready',
    },
    {
      command: 'npm run dev -- --port ' + port,
      url: 'http://127.0.0.1:' + port,
      env: { API_PROXY_TARGET: 'http://127.0.0.1:18080' },
    },
  ],
});
