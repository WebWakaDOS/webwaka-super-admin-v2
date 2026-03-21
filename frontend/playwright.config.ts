import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E Config — Super Admin V2
 * Tests run against the local dev server (port 5175)
 * Mobile First: includes mobile viewport tests
 * NOTE: Start dev server manually before running: npm run dev -- --port 5175
 */

const CHROMIUM_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
]

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-results.json' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5175',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    headless: true,
    actionTimeout: 8_000,
    navigationTimeout: 10_000,
    // Use domcontentloaded to avoid waiting for Vite HMR websocket (networkidle never fires)
    waitForNavigation: 'domcontentloaded',
    launchOptions: {
      args: CHROMIUM_ARGS,
    },
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: CHROMIUM_ARGS },
      },
    },
    {
      name: 'Mobile Chrome (Pixel 5)',
      use: {
        ...devices['Pixel 5'],
        launchOptions: { args: CHROMIUM_ARGS },
      },
    },
  ],
  // No webServer — server must be started manually or via CI
})
