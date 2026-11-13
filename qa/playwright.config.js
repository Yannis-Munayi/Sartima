// Playwright config for the checklist suite (qa/tests). Separate from the
// app's own smoke tests in e2e/ — run it through the dashboard
// (`npm run qa`) or directly:
//   QA_TARGET=local npx playwright test -c qa/playwright.config.js
//   QA_TARGET=live  npx playwright test -c qa/playwright.config.js

import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'
import { BASE_URL, LOCAL_MODE, LOCAL_PORT, QA_DIR, RESULTS_DIR, ROOT, TARGET } from './lib/env.js'

const live = TARGET === 'live'
// The Vite dev server serves the app unbundled (hundreds of module requests
// per page load). With 4 browsers loading at once, page loads ran past 45s
// and unrelated tests failed in page.goto, so dev mode runs fewer workers
// and allows slower navigations.
const devServer = !live && LOCAL_MODE === 'dev'

export default defineConfig({
  testDir: path.join(QA_DIR, 'tests'),
  outputDir: path.join(RESULTS_DIR, 'artifacts'),
  globalSetup: path.join(QA_DIR, 'global-setup.js'),
  fullyParallel: true,
  workers: live ? 3 : devServer ? 2 : 4,
  // One retry on the live site so a network blip shows as "flaky", not a failure
  retries: live ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 12_000 },
  reporter: [
    ['list', { printSteps: false }],
    ['json', { outputFile: path.join(RESULTS_DIR, 'report.json') }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: devServer ? 90_000 : 45_000,
    // The Jarvis-bridge test frames the app from a stand-in hub page; Chrome's
    // local-network checks would otherwise block that page framing localhost.
    launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests'] },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: live ? undefined : {
    command: LOCAL_MODE === 'preview'
      ? `npm run build && npx vite preview --port ${LOCAL_PORT} --strictPort`
      : `npx vite --port ${LOCAL_PORT} --strictPort`,
    cwd: ROOT,
    url: BASE_URL,
    // Always a fresh server on the suite's own port (see LOCAL_PORT in lib/env.js)
    reuseExistingServer: false,
    timeout: LOCAL_MODE === 'preview' ? 240_000 : 60_000,
  },
})
