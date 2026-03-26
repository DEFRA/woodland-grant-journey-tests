import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test/specs',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `https://grants-ui.${process.env.ENVIRONMENT}.cdp-int.defra.cloud`,
    headless: true,
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
