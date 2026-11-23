import { defineConfig } from '@playwright/test';
import config from './playwright.config';

const port = Number(process.env.E2E_PORT || 5173);

export default defineConfig({
  ...config,
  testIgnore: [],
  testMatch: '**/*.integration.spec.ts',
  fullyParallel: false,
  webServer: [{
    command: 'npm run dev -- --port ' + port,
    url: 'http://127.0.0.1:' + port,
    env: { API_PROXY_TARGET: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000' },
  }],
});
