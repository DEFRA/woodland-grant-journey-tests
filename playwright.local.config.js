import { defineConfig, devices } from '@playwright/test'
import { loadEnvFile } from 'node:process'

try { loadEnvFile('.env') } catch { /* no .env file */ }

process.env.BASE_BACKEND_URL = 'http://localhost:3001'

export default defineConfig({
  testDir: './test/specs',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['html', { open: 'on-failure', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:3000',
    headless: false,
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
