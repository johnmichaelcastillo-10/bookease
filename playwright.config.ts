import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against the production build (`vite preview`), the same static files
 * Vercel serves. Uses the locally installed Microsoft Edge channel; set PW_CHANNEL=chrome or
 * leave it empty to use Playwright's bundled Chromium.
 */
const channel = process.env.PW_CHANNEL ?? 'msedge'

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    timezoneId: 'America/New_York',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: channel || undefined }, testIgnore: /responsive\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: channel || undefined }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
